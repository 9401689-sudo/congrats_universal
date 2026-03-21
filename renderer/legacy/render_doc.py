#!/usr/bin/env python3
import json
import os
import sys
import io
import time
import traceback
from typing import Any, Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import qrcode

W, H = 1600, 2400
MARGIN_MIN = 100
BOTTOM_Q_Y = int(H * 0.75)  # 1800

# ---------------------------
# CACHES / SPEEDUPS
# ---------------------------
IMAGE_CACHE: Dict[str, Image.Image] = {}
FONT_CACHE: Dict[str, ImageFont.FreeTypeFont] = {}
PRELOADED_ASSETS: Dict[str, Image.Image] = {}


def ensure_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def clamp(v: float, a: float, b: float) -> float:
    return max(a, min(b, v))


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def read_bytes_retry(path: str, attempts: int = 4) -> bytes:
    """
    Быстрее исходной версии, но всё ещё достаточно устойчиво для rclone/WebDAV.
    """
    last = None
    for i in range(attempts):
        try:
            with open(path, "rb") as f:
                return f.read()
        except OSError as e:
            last = e
            time.sleep(0.05 * (2 ** i))
    raise last  # type: ignore


def open_image_rgba(path: str) -> Image.Image:
    """
    Кэшируем декодированное RGBA-изображение и на выход отдаём copy(),
    чтобы не мутировать оригинал.
    """
    cached = IMAGE_CACHE.get(path)
    if cached is not None:
        return cached.copy()

    data = read_bytes_retry(path)
    im = Image.open(io.BytesIO(data))
    im.load()
    im = im.convert("RGBA")

    IMAGE_CACHE[path] = im
    return im.copy()


def ensure_font_local(font_path: str) -> str:
    local_dir = "/opt/razresheno/tmp"
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, "font_cache_" + os.path.basename(font_path))
    try:
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            return local_path
        data = read_bytes_retry(font_path)
        with open(local_path, "wb") as f:
            f.write(data)
        return local_path
    except Exception:
        return font_path


def fit_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    if img.size == (W, H):
        return img

    scale = max(W / img.width, H / img.height)
    nw, nh = int(img.width * scale), int(img.height * scale)

    # Был LANCZOS — очень дорого. Для фона BICUBIC обычно визуально ок.
    resized = img.resize((nw, nh), Image.BICUBIC)

    left = (nw - W) // 2
    top = (nh - H) // 2
    return resized.crop((left, top, left + W, top + H))


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    key = f"{path}:{size}"
    cached = FONT_CACHE.get(key)
    if cached is not None:
        return cached

    try:
        font = ImageFont.truetype(path, size=size)
    except Exception:
        try:
            p2 = ensure_font_local(path)
            font = ImageFont.truetype(p2, size=size)
        except Exception:
            font = ImageFont.load_default()

    FONT_CACHE[key] = font
    return font


def text_bbox(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> Tuple[int, int, int, int]:
    return draw.textbbox((0, 0), text, font=font)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> List[str]:
    words = (text or "").split()
    if not words:
        return [""]

    lines: List[str] = []
    cur = words[0]
    for w in words[1:]:
        cand = cur + " " + w
        bbox = text_bbox(draw, cand, font)
        if (bbox[2] - bbox[0]) <= max_width:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def draw_wrapped(
    img: Image.Image,
    x: int,
    y: int,
    text: str,
    font: ImageFont.ImageFont,
    fill: Tuple[int, int, int, int],
    max_width: int,
    line_gap: int
) -> int:
    draw = ImageDraw.Draw(img)
    y0 = y
    for para in (text or "").split("\n"):
        para = para.strip()
        if para == "":
            y += line_gap
            continue
        lines = wrap_text(draw, para, font, max_width)
        for line in lines:
            draw.text((x, y), line, font=font, fill=fill)
            bbox = text_bbox(draw, line, font)
            y += (bbox[3] - bbox[1]) + line_gap
    return y - y0


def draw_label_value_wrapped(
    img: Image.Image,
    x: int,
    y: int,
    label: str,
    value: str,
    label_font: ImageFont.ImageFont,
    value_font: ImageFont.ImageFont,
    fill: Tuple[int, int, int, int],
    max_width: int,
    line_gap: int,
    gap: int = 10
) -> int:
    draw = ImageDraw.Draw(img)

    label = (label or "").rstrip()
    value = (value or "").strip()

    if not value:
        return 0

    label_bbox = text_bbox(draw, label, label_font)
    label_w = label_bbox[2] - label_bbox[0]
    label_h = label_bbox[3] - label_bbox[1]

    draw.text((x, y), label, font=label_font, fill=fill)

    value_x = x + label_w + gap
    value_max_width = max_width - label_w - gap

    if value_max_width < 80:
        value_x = x
        y += label_h + line_gap
        value_max_width = max_width

    lines = wrap_text(draw, value, value_font, value_max_width)
    total_h = 0

    first_line = True
    current_y = y
    for line in lines:
        vx = value_x if first_line else x
        draw.text((vx, current_y), line, font=value_font, fill=fill)
        bbox = text_bbox(draw, line, value_font)
        line_h = bbox[3] - bbox[1]
        current_y += line_h + line_gap
        total_h += line_h + line_gap
        first_line = False

    return max(label_h, total_h)


def apply_opacity(img: Image.Image, opacity: float) -> Image.Image:
    opacity = clamp(opacity, 0.0, 1.0)
    if opacity >= 0.999:
        return img
    img = img.convert("RGBA")
    r, g, b, a = img.split()
    a = a.point(lambda p: int(p * opacity))
    return Image.merge("RGBA", (r, g, b, a))


def tint_rgba(img: Image.Image, color: Tuple[int, int, int]) -> Image.Image:
    img = img.convert("RGBA")
    r, g, b, a = img.split()
    gray = Image.merge("RGB", (r, g, b)).convert("L")
    cr, cg, cb = color

    def lut(c):
        return [int((v / 255.0) * c) for v in range(256)]

    rr = gray.point(lut(cr))
    gg = gray.point(lut(cg))
    bb = gray.point(lut(cb))
    return Image.merge("RGBA", (rr, gg, bb, a))


def paste_with_transform(
    base: Image.Image,
    overlay: Image.Image,
    x: int,
    y: int,
    rot: float,
    scale: float,
    opacity: float
) -> None:
    overlay = overlay.convert("RGBA")
    scale = clamp(scale, 0.1, 3.0)
    ow, oh = overlay.size

    # Был LANCZOS — дорого. Для штампа/печати BICUBIC обычно достаточно.
    overlay = overlay.resize((int(ow * scale), int(oh * scale)), Image.BICUBIC)

    overlay = apply_opacity(overlay, opacity)
    if abs(rot) > 0.01:
        overlay = overlay.rotate(rot, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(overlay, dest=(int(x), int(y)))


def make_qr(qr_url: str, size: int = 140) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,   # было 10 — сильно тяжелее
        border=2
    )
    qr.add_data(qr_url or "")
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
    img = img.resize((size, size), Image.NEAREST)
    return img


def draw_centered_wrapped(
    img: Image.Image,
    y: int,
    text: str,
    font: ImageFont.ImageFont,
    fill: Tuple[int, int, int, int],
    max_width: int,
    line_gap: int
) -> int:
    draw = ImageDraw.Draw(img)
    total_h = 0
    for para in (text or "").split("\n"):
        para = para.strip()
        if para == "":
            total_h += line_gap
            y += line_gap
            continue
        lines = wrap_text(draw, para, font, max_width)
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            x = (W - tw) // 2
            draw.text((x, y), line, font=font, fill=fill)
            y += th + line_gap
            total_h += th + line_gap
    return total_h


def draw_watermark_repeated(base: Image.Image, lines: List[str], font_path: str) -> None:
    """
    Watermark: чуть менее прозрачный и повторяем 4 раза по вертикали.
    """
    lines = [l.strip() for l in (lines or []) if l.strip()]
    if not lines:
        return
    if len(lines) > 2:
        lines = lines[:2]

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = load_font(font_path, 78)

    bboxes = [d.textbbox((0, 0), t, font=font) for t in lines]
    widths = [b[2] - b[0] for b in bboxes]
    heights = [b[3] - b[1] for b in bboxes]
    th = sum(heights) + (24 if len(lines) == 2 else 0)

    cx = W // 2
    centers = [int(H * 0.34), int(H * 0.48), int(H * 0.62), int(H * 0.76)]

    for cy in centers:
        y0 = cy - th // 2
        for idx, t in enumerate(lines):
            w = widths[idx]
            h = heights[idx]
            d.text((cx - w // 2, y0), t, font=font, fill=(0, 0, 0, 52))
            y0 += h + 24

    rotated = layer.rotate(-22, expand=False, resample=Image.BICUBIC)
    base.alpha_composite(rotated)


def seal_color_to_rgb(name: str) -> Tuple[int, int, int]:
    if not name:
        return (176, 0, 32)
    name = name.lower()
    if name in ("season_pink", "pink", "magenta"):
        return (176, 0, 64)
    if name in ("red", "classic_red"):
        return (176, 0, 32)
    if name in ("green",):
        return (0, 140, 80)
    return (176, 0, 32)


def clamp_overlay_to_middle_60_percent(x: int, y: int, w: int, h: int) -> Tuple[int, int]:
    zone_left = int(W * 0.20)
    zone_right = int(W * 0.80)

    x_min = zone_left
    x_max = zone_right - w
    if x_max < x_min:
        x_max = x_min

    y_min = int(BOTTOM_Q_Y - (h / 2))
    y_max = H - MARGIN_MIN - h
    if y_max < y_min:
        y_min = y_max

    return int(clamp(x, x_min, x_max)), int(clamp(y, y_min, y_max))


def preload_assets(templ_dir: str, assets: Dict[str, str]) -> None:
    """
    Предзагрузка печати и штампа в память для ускорения.
    Фон не preload-им глобально, потому что он меняется чаще и файлов несколько.
    """
    for k in ("seal", "stamp"):
        p = assets.get(k)
        if p and os.path.exists(p) and p not in PRELOADED_ASSETS:
            PRELOADED_ASSETS[p] = open_image_rgba(p)


def normalize_input(inp: Dict[str, Any]) -> Dict[str, Any]:
    mode = inp.get("mode")
    is_final = bool(inp.get("is_final", False))
    if mode not in ("preview", "final"):
        mode = "final" if is_final else "preview"

    assets = inp.get("assets") or {}
    templ_dir = inp.get("templates_dir") or "/mnt/razresheno/templates"

    if "bg" not in assets:
        bg_file = inp.get("bg") or inp.get("background") or "bg1.png"
        bg_path = os.path.join(templ_dir, bg_file)
        if not os.path.exists(bg_path):
            bg_path = os.path.join(templ_dir, "backgrounds", bg_file)
        assets["bg"] = bg_path
    if "seal" not in assets:
        assets["seal"] = os.path.join(templ_dir, "seal", "seal.png")
    if "stamp" not in assets:
        assets["stamp"] = os.path.join(templ_dir, "stamp", "stamp_blue.png")
    if "font" not in assets:
        assets["font"] = os.path.join(templ_dir, "fonts", "Inter.ttf")
    if "font_semibold" not in assets:
        assets["font_semibold"] = os.path.join(templ_dir, "fonts", "Inter-SemiBold.ttf")

    layout = inp.get("layout") or {}
    seal = layout.get("seal") or {}
    stamp = layout.get("stamp") or {}

    out_path = inp.get("output_path") or inp.get("out_path") or "/tmp/razresheno_render.png"

    return {
        "mode": mode,
        "recipient_name": inp.get("recipient_name") or "",
        "initiator_name": inp.get("initiator_name") or "",
        "doc_no": inp.get("doc_no") or inp.get("doc_number") or "0803-000",
        "header_small": inp.get("header_small") or "Специальный выпуск к 8 марта\nРегламентирующая инстанция «РАЗРЕШЕНО»",
        "title": inp.get("title") or "РАЗРЕШЕНО",
        "subtitle": inp.get("subtitle") or f"ОФИЦИАЛЬНЫЙ ДОКУМЕНТ № {inp.get('doc_no') or inp.get('doc_number') or '0803-000'}",
        "intro": inp.get("intro") or "Настоящим разрешается:",
        "points": inp.get("points") or [],
        "footer_lines": inp.get("footer_lines") or ["Вступает в силу немедленно.", "Обжалованию не подлежит."],
        "watermark_lines": inp.get("watermark_lines") or ["Предварительная версия.", "Не заверено."],
        "source_line": inp.get("source_line") or "Источник оформления: razresheno",
        "qr_url": inp.get("qr_url") or "https://t.me/razresheno_buro_bot?start=docqr",
        "text_block_y": int(inp.get("text_block_y") or 760),
        "assets": assets,
        "seal": {
            "x": int(seal.get("x", 980)),
            "y": int(seal.get("y", 1820)),
            "rot": float(seal.get("rot", -6)),
            "opacity": float(seal.get("opacity", 0.82)),
            "scale": float(seal.get("scale", 0.82)),
            "color": str(seal.get("color", "season_pink"))
        },
        "stamp": {
            "x": int(stamp.get("x", 260)),
            "y": int(stamp.get("y", 1880)),
            "rot": float(stamp.get("rot", 8)),
            "opacity": float(stamp.get("opacity", 0.9)),
            "scale": float(stamp.get("scale", 0.9))
        },
        "output_path": out_path
    }


def render_doc(inp: Dict[str, Any]) -> str:
    cfg = normalize_input(inp)
    assets = cfg["assets"]

    for k in ("bg", "seal", "stamp", "font"):
        p = assets.get(k)
        if not p or not os.path.exists(p):
            raise FileNotFoundError(f"Asset not found: {k} -> {p}")

    # preload seal/stamp
    templ_dir = inp.get("templates_dir") or "/mnt/razresheno/templates"
    preload_assets(templ_dir, assets)

    base = fit_background(open_image_rgba(assets["bg"]))
    base = ImageEnhance.Contrast(base).enhance(1.04)
    base = ImageEnhance.Color(base).enhance(0.95)

    draw = ImageDraw.Draw(base)
    font_path = ensure_font_local(assets["font"])
    font_semibold_path = assets.get("font_semibold") or assets["font"]
    if not os.path.exists(font_semibold_path):
        font_semibold_path = assets["font"]
    font_semibold_path = ensure_font_local(font_semibold_path)

    # Шрифты
    f_title = load_font(font_path, 83)
    f_small = load_font(font_path, 30)
    f_small_bold = load_font(font_semibold_path, 30)
    f_mono = load_font(font_path, 30)
    f_sub = load_font(font_semibold_path, 40)
    f_body = load_font(font_path, 42)
    f_points = load_font(font_path, 40)
    f_points_bold = load_font(font_semibold_path, 40)
    f_footer = load_font(font_path, 38)
    f_footer_bold = load_font(font_semibold_path, 38)

    # Поля
    margin_title = int(140 * 1.2)   # 168
    margin_block = int(280 * 1.2)   # 336
    margin_block_left = int(margin_block * 0.9)  # левое поле основного блока -10%
    margin_block_right = margin_block
    maxw_block = W - margin_block_left - margin_block_right

    small_line_gap = 10
    body_line_gap = 12
    points_line_gap = 10
    footer_line_gap = 10

    # Метрики высот строк
    small_h = text_bbox(draw, "Регламентирующая инстанция «РАЗРЕШЕНО»", f_small)[3] - text_bbox(draw, "Регламентирующая инстанция «РАЗРЕШЕНО»", f_small)[1]
    sub_h = text_bbox(draw, "ОФИЦИАЛЬНЫЙ ДОКУМЕНТ № 0803-000", f_sub)[3] - text_bbox(draw, "ОФИЦИАЛЬНЫЙ ДОКУМЕНТ № 0803-000", f_sub)[1]

    # Верхний блок
    y = 130 + small_h

    header_lines = [line.strip() for line in str(cfg["header_small"]).split("\n") if line.strip()]
    small_line_positions: List[int] = []

    for line in header_lines:
        small_line_positions.append(y)
        draw.text((margin_title, y), line, font=f_small, fill=(20, 20, 20, 220))
        bbox = text_bbox(draw, line, f_small)
        y += (bbox[3] - bbox[1]) + small_line_gap

    y += 14

    # Заголовок
    draw.text((margin_title, y), cfg["title"], font=f_title, fill=(10, 10, 10, 255))

    # Правый верхний номер — по второй строке header_small
    meta = f"ДОКУМЕНТ № {cfg['doc_no']}"
    mb = text_bbox(draw, meta, f_mono)
    meta_x = W - margin_title - (mb[2] - mb[0])

    if len(small_line_positions) >= 2:
        meta_y = small_line_positions[1]
    else:
        meta_y = small_line_positions[0] if small_line_positions else y

    draw.text((meta_x, meta_y), meta, font=f_mono, fill=(10, 10, 10, 210))

    # Основной блок
    y_block = int(cfg["text_block_y"]) + sub_h

    # Subtitle
    subtitle_used = draw_centered_wrapped(
        base,
        y_block,
        cfg["subtitle"],
        f_sub,
        (10, 10, 10, 235),
        maxw_block,
        10
    )
    y_block += subtitle_used + sub_h

    rec = (cfg["recipient_name"] or "").strip()
    if rec:
        issued_used = draw_label_value_wrapped(
            base,
            margin_block_left,
            y_block,
            "Выдано в отношении:",
            rec,
            f_points,
            f_points_bold,
            (10, 10, 10, 215),
            maxw_block,
            points_line_gap,
            gap=10
        )
        y_block += issued_used + sub_h

    intro_used = draw_wrapped(
        base,
        margin_block_left,
        y_block,
        cfg["intro"],
        f_body,
        (10, 10, 10, 245),
        maxw_block,
        body_line_gap
    )
    y_block += intro_used + 14

    # До 8 пунктов
    for p in (cfg.get("points") or [])[:8]:
        p = str(p).strip()
        if not p:
            continue
        draw.text((margin_block_left, y_block), "—", font=f_points, fill=(10, 10, 10, 235))
        used = draw_wrapped(
            base,
            margin_block_left + 34,
            y_block,
            p.lstrip("—").strip(),
            f_points,
            (10, 10, 10, 235),
            maxw_block - 34,
            points_line_gap
        )
        y_block += max(used, 48) + 16

    footer_y = y_block + sub_h
    footer_lines = [str(x).strip() for x in (cfg.get("footer_lines") or []) if str(x).strip()]
    current_footer_y = footer_y
    for line in footer_lines:
        used = draw_wrapped(
            base,
            margin_block_left,
            current_footer_y,
            line,
            f_footer_bold,
            (10, 10, 10, 225),
            maxw_block,
            footer_line_gap
        )
        current_footer_y += used

    # Низ
    bottom_y = H - 170
    draw.text((margin_title, bottom_y), str(cfg.get("source_line") or ""), font=f_small, fill=(10, 10, 10, 160))

    ini = (cfg.get("initiator_name") or "").strip()
    if cfg["mode"] == "final" and ini:
        draw_label_value_wrapped(
            base,
            margin_title,
            bottom_y - 54,
            "Инициатор документа:",
            ini,
            f_small_bold,
            f_small,
            (10, 10, 10, 210),
            W - margin_title * 2,
            8,
            gap=10
        )

    # QR
    qr_url = (cfg.get("qr_url") or "").strip()
    if qr_url:
        qr_size = 140
        qr_img = make_qr(qr_url, size=qr_size)
        base.alpha_composite(qr_img, dest=(W - margin_title - qr_size, H - margin_title - qr_size))

    if cfg["mode"] == "preview":
        draw_watermark_repeated(base, cfg.get("watermark_lines") or [], font_path)

    # Штамп
    stamp_path = assets["stamp"]
    stamp = PRELOADED_ASSETS.get(stamp_path)
    if stamp is None:
        stamp = open_image_rgba(stamp_path)
        PRELOADED_ASSETS[stamp_path] = stamp.copy()
    stamp = stamp.copy()

    stamp_scale = float(cfg["stamp"]["scale"])
    sw = int(stamp.width * stamp_scale)
    sh = int(stamp.height * stamp_scale)

    default_stamp_x = int(W * 0.38) - (sw // 2)
    stamp_x_raw = int(cfg["stamp"]["x"])
    if stamp_x_raw < int(W * 0.20) or stamp_x_raw > int(W * 0.80):
        stamp_x_raw = default_stamp_x

    sx, sy = clamp_overlay_to_middle_60_percent(
        stamp_x_raw,
        int(cfg["stamp"]["y"]),
        sw,
        sh
    )
    paste_with_transform(base, stamp, sx, sy, cfg["stamp"]["rot"], stamp_scale, cfg["stamp"]["opacity"])

    # Печать
    seal_path = assets["seal"]
    seal = PRELOADED_ASSETS.get(seal_path)
    if seal is None:
        seal = open_image_rgba(seal_path)
        PRELOADED_ASSETS[seal_path] = seal.copy()
    seal = seal.copy()

    seal = tint_rgba(seal, seal_color_to_rgb(cfg["seal"].get("color", "season_pink")))
    seal_scale = float(cfg["seal"]["scale"])
    pw = int(seal.width * seal_scale)
    ph = int(seal.height * seal_scale)

    default_seal_x = int(W * 0.62) - (pw // 2)
    seal_x_raw = int(cfg["seal"]["x"])
    if seal_x_raw < int(W * 0.20) or seal_x_raw > int(W * 0.80):
        seal_x_raw = default_seal_x

    px, py = clamp_overlay_to_middle_60_percent(
        seal_x_raw,
        int(cfg["seal"]["y"]),
        pw,
        ph
    )
    paste_with_transform(base, seal, px, py, cfg["seal"]["rot"], seal_scale, cfg["seal"]["opacity"])

    out_path = cfg["output_path"]
    ensure_dir(out_path)

    # Был optimize=True — медленно.
    base.save(out_path, format="PNG", compress_level=1)
    return out_path


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "--worker":
        worker_main()
        return

    if len(sys.argv) < 2:
        print("Usage: render_doc.py <input_json_path>", file=sys.stderr)
        sys.exit(2)

    in_path = sys.argv[1]
    inp = load_json(in_path)
    out_path = render_doc(inp)
    print(out_path)


def worker_main() -> None:
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue

        req_id = None
        try:
            request = json.loads(raw)
            req_id = request.get("id")
            inp = request.get("input") or {}
            started_at = time.perf_counter()
            out_path = render_doc(inp)
            duration_ms = int((time.perf_counter() - started_at) * 1000)

            sys.stdout.write(json.dumps({
                "id": req_id,
                "ok": True,
                "output_path": out_path,
                "duration_ms": duration_ms,
            }, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as exc:
            sys.stdout.write(json.dumps({
                "id": req_id,
                "ok": False,
                "error": str(exc),
                "traceback": traceback.format_exc(),
            }, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
