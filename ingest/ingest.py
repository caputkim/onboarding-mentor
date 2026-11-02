#!/usr/bin/env python3
"""
운영자 맥에서 실행하는 지식 수집 스크립트 (docs/03_아키텍처.md §6, 1안).
Drive 마운트나 로컬 리포 폴더를 돌며 hwpx·docx·md·txt·pdf 를 텍스트로 바꿔 서버 /api/admin/ingest 로 푸시한다.
요약·태그·개인정보 판정은 서버가 한다. 여기서는 변환·해시·전송만.

  python3 ingest/ingest.py --source drive --root "$DRIVE/0000_결과보고서_모음" --server http://localhost:3001 --token "$INGEST_TOKEN"
  python3 ingest/ingest.py --source github --root ../nxtcloud-llm-gateway --prefix nxtcloud-llm-gateway --include md
  python3 ingest/ingest.py ... --dry        # 전송 없이 대상만 출력

표준 라이브러리만 쓴다 (Python 3.9+). hwpx·docx 변환은 _보고서도구/doctext.py 를 서브프로세스로 호출한다.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
def _find_doctext() -> Path:
    """상위 폴더를 거슬러 올라가며 _보고서도구/doctext.py 를 찾는다 (nxtcloud.nosync/_보고서도구). 없으면 --doctext 로 지정."""
    for base in [HERE, *HERE.parents]:
        cand = base / "_보고서도구" / "doctext.py"
        if cand.exists():
            return cand
    return HERE.parent.parent.parent / "_보고서도구" / "doctext.py"


DEFAULT_DOCTEXT = Path(os.environ["DOCTEXT"]) if os.environ.get("DOCTEXT") else _find_doctext()
CACHE = HERE / ".cache" / "hashes.json"
SKIP_NAME = re.compile(r"(출석부|명단|연락처|개인정보|계약서|견적|accessKeys|credentials|\.env$|secret|_백업_|~\$)", re.I)
SKIP_DIR = {"node_modules", ".git", ".next", "cdk.out", "dist", "BinData", "__pycache__", ".cache", "venv", ".venv"}
EXT_TEXT = {".md", ".txt", ".markdown"}
EXT_DOC = {".hwpx", ".docx"}
EXT_PDF = {".pdf"}


def convert(path: Path, doctext: Path) -> str:
    ext = path.suffix.lower()
    if path.name.lower().endswith(".hwp.hwpx"):
        ext = ".hwpx"
    if ext in EXT_TEXT:
        return path.read_text(encoding="utf-8", errors="replace")
    if ext in EXT_DOC:
        if not doctext.exists():
            raise RuntimeError(f"doctext.py 가 없음: {doctext}")
        out = subprocess.run([sys.executable, "-I", str(doctext), str(path)], capture_output=True, text=True, timeout=120)
        if out.returncode != 0:
            raise RuntimeError(out.stderr.strip()[:300] or "doctext 실패")
        return out.stdout
    if ext in EXT_PDF:
        try:
            out = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, timeout=120)
        except FileNotFoundError:
            raise RuntimeError("pdftotext 없음 (brew install poppler)")
        if out.returncode != 0:
            raise RuntimeError(out.stderr.strip()[:300] or "pdftotext 실패")
        return out.stdout
    raise RuntimeError("지원하지 않는 형식")


def walk(root: Path, include: set):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR and not d.startswith(".")]
        for name in filenames:
            p = Path(dirpath) / name
            ext = p.suffix.lower().lstrip(".")
            if name.lower().endswith(".hwp.hwpx"):
                ext = "hwpx"
            if ext not in include:
                continue
            if SKIP_NAME.search(name):
                print(f"  건너뜀(파일명 패턴): {p.relative_to(root)}")
                continue
            if p.stat().st_size > 300 * 1024 * 1024:
                print(f"  건너뜀(300MB 초과): {p.relative_to(root)}")
                continue
            yield p


def post(server: str, token: str, payload: dict) -> dict:
    req = urllib.request.Request(
        server.rstrip("/") + "/api/admin/ingest",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {e.code}: {body}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["drive", "github"], required=True)
    ap.add_argument("--root", required=True, help="걸어 다닐 최상위 폴더")
    ap.add_argument("--prefix", default=None, help="문서 path 키 접두어. 기본은 root 폴더명")
    ap.add_argument("--include", default="hwpx,docx,md,txt,pdf", help="확장자 목록 (쉼표)")
    ap.add_argument("--server", default=os.environ.get("ONBOARD_SERVER", "http://localhost:3001"), help="멘토·운영 서비스 주소 (로컬 기본 3001)")
    ap.add_argument("--token", default=os.environ.get("INGEST_TOKEN"))
    ap.add_argument("--doctext", default=str(DEFAULT_DOCTEXT))
    ap.add_argument("--batch", type=int, default=5)
    ap.add_argument("--force", action="store_true", help="로컬 캐시와 서버 해시를 무시하고 전부 다시 처리 (요약 재생성)")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        sys.exit(f"폴더가 아님: {root}")
    prefix = args.prefix or root.name
    include = {e.strip().lower().lstrip(".") for e in args.include.split(",") if e.strip()}
    if not args.dry and not args.token:
        sys.exit("--token 또는 INGEST_TOKEN 이 필요함")

    cache = {}
    if CACHE.exists() and not args.force:
        cache = json.loads(CACHE.read_text())

    print(f"root={root} source={args.source} prefix={prefix} include={sorted(include)}")
    batch, run_id, sent, stats = [], None, 0, {"created": 0, "updated": 0, "skipped": 0, "excluded": 0, "error": 0}

    def flush(final=False):
        nonlocal batch, run_id, sent
        if not batch and not final:
            return
        if args.dry:
            for d in batch:
                print(f"  [dry] {d['path']} ({len(d['text'])}자)")
            batch = []
            return
        if not batch and final and run_id is None:
            return
        payload = {"source": args.source.upper(), "finalize": final, "documents": batch, "force": bool(args.force)}
        if run_id:
            payload["runId"] = run_id
        res = post(args.server, args.token, payload)
        run_id = res["runId"]
        for r in res["results"]:
            stats[r["action"]] = stats.get(r["action"], 0) + 1
            extra = f" — {r.get('reason')}" if r.get("reason") else ""
            exc = r.get("excludedSections") or []
            print(f"  {r['action']:8} {r['path']}{extra}{f' (제외 섹션 {len(exc)})' if exc else ''}")
            key = r["path"]
            if r["action"] in ("created", "updated", "skipped"):
                cache[key] = next((d["hash"] for d in batch if d["path"] == key), None)
        sent += len(batch)
        batch = []

    for p in walk(root, include):
        rel = str(p.relative_to(root))
        key = f"{args.source}:{prefix}/{rel}"
        try:
            text = convert(p, Path(args.doctext))
        except Exception as e:  # noqa: BLE001
            print(f"  변환 실패: {rel} — {e}")
            stats["error"] += 1
            continue
        text = text.strip()
        if len(text) < 50:
            print(f"  건너뜀(본문 50자 미만): {rel}")
            continue
        h = hashlib.sha256(text.encode("utf-8")).hexdigest()
        if cache.get(key) == h:
            stats["skipped"] += 1
            continue
        batch.append({
            "path": key,
            "title": p.stem.replace(".hwp", ""),
            "text": text,
            "hash": h,
            "sourceMeta": {"file": rel, "size": p.stat().st_size, "mtime": int(p.stat().st_mtime)},
        })
        if len(batch) >= args.batch:
            flush()
    flush(final=True)

    if not args.dry:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
    print(f"\n완료: 전송 {sent}건 · " + " · ".join(f"{k} {v}" for k, v in stats.items()))


if __name__ == "__main__":
    main()
