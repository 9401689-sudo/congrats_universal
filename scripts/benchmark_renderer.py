#!/usr/bin/env python3
import argparse
import json
import statistics
import subprocess
import tempfile
import time
from pathlib import Path


def build_payload(output_path: Path, templates_dir: str) -> dict:
    return {
        "mode": "preview",
        "recipient_name": "Мария",
        "initiator_name": "Илья",
        "doc_no": "0803-001",
        "templates_dir": templates_dir,
        "bg": "bg1.png",
        "intro": "Настоящим разрешается:",
        "points": [
            "Принимать поздравления без ограничений.",
            "Требовать кофе, цветы и повышенное внимание.",
            "Временно игнорировать лишнюю бюрократию."
        ],
        "layout": {
            "seal": {"x": 980, "y": 1820, "rot": -6, "opacity": 0.82, "scale": 0.82},
            "stamp": {"x": 260, "y": 1880, "rot": 8, "opacity": 0.9, "scale": 0.9}
        },
        "qr_url": "https://t.me/razresheno_buro_bot",
        "output_path": str(output_path),
    }


def benchmark_cli(python_bin: str, script_path: str, templates_dir: str, iterations: int) -> list[float]:
    durations = []
    with tempfile.TemporaryDirectory(prefix="bench-render-cli-") as temp_dir:
        temp_path = Path(temp_dir)
        for idx in range(iterations):
            output_path = temp_path / f"cli_{idx}.png"
            payload_path = temp_path / f"cli_{idx}.json"
            payload = build_payload(output_path, templates_dir)
            payload_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

            started_at = time.perf_counter()
            subprocess.run(
                [python_bin, script_path, str(payload_path)],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            durations.append((time.perf_counter() - started_at) * 1000)
    return durations


def benchmark_worker(python_bin: str, script_path: str, templates_dir: str, iterations: int) -> list[float]:
    durations = []
    with tempfile.TemporaryDirectory(prefix="bench-render-worker-") as temp_dir:
        temp_path = Path(temp_dir)
        process = subprocess.Popen(
            [python_bin, script_path, "--worker"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        assert process.stdin is not None
        assert process.stdout is not None
        try:
            for idx in range(iterations):
                output_path = temp_path / f"worker_{idx}.png"
                payload = build_payload(output_path, templates_dir)
                started_at = time.perf_counter()
                process.stdin.write(
                    json.dumps({"id": str(idx), "input": payload}, ensure_ascii=False) + "\n"
                )
                process.stdin.flush()
                line = process.stdout.readline()
                durations.append((time.perf_counter() - started_at) * 1000)
                response = json.loads(line)
                if not response.get("ok"):
                    raise RuntimeError(response)
        finally:
            process.kill()
            process.wait(timeout=5)
    return durations


def summarize(label: str, durations: list[float]) -> None:
    print(
        f"{label}: count={len(durations)} avg={statistics.mean(durations):.1f}ms "
        f"min={min(durations):.1f}ms max={max(durations):.1f}ms"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--python-bin", required=True)
    parser.add_argument("--script-path", required=True)
    parser.add_argument("--templates-dir", required=True)
    parser.add_argument("--iterations", type=int, default=5)
    args = parser.parse_args()

    cli = benchmark_cli(args.python_bin, args.script_path, args.templates_dir, args.iterations)
    worker = benchmark_worker(
        args.python_bin, args.script_path, args.templates_dir, args.iterations
    )

    summarize("cli", cli)
    summarize("worker", worker)


if __name__ == "__main__":
    main()
