"""Icon wiring guard: every Font Awesome icon used by the site must exist in
the FA Free set under the style it is requested with.

Background: FA Free ships a full solid set but a small regular subset and a
brands-only set. Requesting `fa-regular fa-truck` (solid-only) renders a blank
box — this was the cause of missing icons before the 2026-08 audit. These
tests fail closed when:

- an icon is used with `fa-regular` but has no glyph in the free regular font,
- an icon is used with `fa-brands` but is not a free brand icon,
- a page uses FA icons without loading the Font Awesome stylesheet,
- legacy FA4/FA5 `fas/far/fab` prefixes sneak back in.

The allowlists are curated against Font Awesome Free 6.7.2 metadata
(fontawesome.com free styles); extend them only when the vendored CDN version
is bumped and the new icons are verified against the official metadata.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Official FA6 Free REGULAR subset (canonical names + stable FA5-era aliases).
FA_FREE_REGULAR = {
    "address-book", "address-card", "bell", "bell-slash", "bookmark",
    "building", "calendar", "calendar-check", "calendar-days",
    "calendar-minus", "calendar-plus", "calendar-xmark", "chart-bar",
    "circle", "circle-check", "circle-dot", "circle-down", "circle-left",
    "circle-pause", "circle-play", "circle-question", "circle-right",
    "circle-stop", "circle-up", "circle-user", "circle-xmark", "clipboard",
    "clock", "clone", "closed-captioning", "comment", "comment-dots",
    "comments", "compass", "copy", "copyright", "credit-card", "envelope",
    "envelope-open", "eye", "eye-slash", "face-angry", "face-dizzy",
    "face-flushed", "face-frown", "face-frown-open", "face-grimace",
    "face-grin", "face-grin-beam", "face-grin-beam-sweat", "face-grin-hearts",
    "face-grin-squint", "face-grin-squint-tears", "face-grin-stars",
    "face-grin-tears", "face-grin-tongue", "face-grin-tongue-squint",
    "face-grin-tongue-wink", "face-grin-wide", "face-grin-wink", "face-kiss",
    "face-kiss-beam", "face-kiss-wink-heart", "face-laugh", "face-laugh-beam",
    "face-laugh-squint", "face-laugh-wink", "face-meh", "face-meh-blank",
    "face-rolling-eyes", "face-sad-cry", "face-sad-tear", "face-smile",
    "face-smile-beam", "face-smile-wink", "face-surprise", "face-tired",
    "file", "file-audio", "file-code", "file-excel", "file-image",
    "file-lines", "file-pdf", "file-powerpoint", "file-video", "file-word",
    "file-zipper", "flag", "floppy-disk", "folder", "folder-open", "futbol",
    "gem", "hand", "hand-back-fist", "hand-lizard", "hand-peace",
    "hand-point-down", "hand-point-left", "hand-point-right", "hand-point-up",
    "hand-pointer", "hand-scissors", "hand-spock", "handshake", "hard-drive",
    "heart", "hospital", "hourglass", "hourglass-end", "id-badge", "id-card",
    "image", "images", "keyboard", "lemon", "life-ring", "lightbulb", "map",
    "message", "moon", "newspaper", "note-sticky", "object-group",
    "object-ungroup", "paper-plane", "paste", "pen-to-square",
    "rectangle-list", "rectangle-xmark", "registered", "share-from-square",
    "snowflake", "square", "square-caret-down", "square-caret-left",
    "square-caret-right", "square-caret-up", "square-check", "square-full",
    "square-minus", "square-plus", "star", "star-half", "star-half-stroke",
    "sun", "thumbs-down", "thumbs-up", "trash-can", "user",
    "window-maximize", "window-minimize", "window-restore",
    # stable FA5-era aliases still emitted by FA6 CSS
    "arrow-alt-circle-down", "arrow-alt-circle-left",
    "arrow-alt-circle-right", "arrow-alt-circle-up", "calendar-alt",
    "calendar-times", "caret-square-down", "caret-square-left",
    "caret-square-right", "caret-square-up", "check-circle", "check-square",
    "comment-alt", "dot-circle", "edit", "file-alt", "file-archive",
    "futbol-ball", "hdd", "hourglass-empty", "list-alt", "money-bill-alt",
    "pause-circle", "play-circle", "plus-square", "minus-square",
    "question-circle", "save", "soccer-ball", "sticky-note", "stop-circle",
    "times-circle", "trash-alt", "user-circle", "window-close",
}

# Curated FA6 Free BRANDS subset (social/payment/platform marks). Extend when
# a new brand icon is needed and confirmed free in the FA metadata.
FA_FREE_BRANDS = {
    "airbnb", "alipay", "amazon", "amazon-pay", "android", "angular",
    "apple", "apple-pay", "aws", "behance", "bitcoin", "blogger",
    "bootstrap", "btc", "chrome", "css3", "discord", "docker", "dribbble",
    "dropbox", "ebay", "ethereum", "etsy", "facebook", "facebook-f",
    "facebook-messenger", "figma", "firefox", "flickr", "flutter", "github",
    "github-alt", "gitlab", "google", "google-pay", "google-play", "html5",
    "hubspot", "instagram", "java", "js", "kickstarter", "linkedin",
    "linkedin-in", "linux", "magento", "mastodon", "medium", "medium-m",
    "meta", "microsoft", "node", "node-js", "npm", "odnoklassniki",
    "opencart", "opera", "patreon", "paypal", "php", "pinterest",
    "pinterest-p", "playstation", "python", "quora", "react", "reddit",
    "reddit-alien", "rust", "salesforce", "sass", "shopify", "skype",
    "slack", "snapchat", "soundcloud", "spotify", "square-facebook",
    "square-github", "square-gitlab", "square-instagram", "square-js",
    "square-pinterest", "square-reddit", "square-snapchat", "square-steam",
    "square-tumblr", "square-twitter", "square-vimeo", "square-whatsapp",
    "square-x-twitter", "square-youtube", "stack-overflow", "steam",
    "stripe", "stripe-s", "telegram", "telegram-plane", "threads", "tiktok",
    "trello", "tripadvisor", "tumblr", "twitch", "twitter", "uber", "ubuntu",
    "unsplash", "ups", "usb", "usps", "viber", "vimeo", "vimeo-v", "vk",
    "vuejs", "whatsapp", "wikipedia-w", "windows", "wordpress", "x-twitter",
    "xbox", "xing", "yahoo", "yelp", "youtube", "zoom",
}

ICON_PAIR = re.compile(r"\bfa-(solid|regular|brands)\s+fa-([a-z0-9-]+)")
LEGACY_PREFIX = re.compile(r"""[\s"'](?:fas|far|fab)\s+fa-[a-z0-9-]+""")
FA_CSS = re.compile(r"font-awesome/[^/\"']+/css/all\.min\.css")


def site_files() -> list[Path]:
    paths = list(ROOT.glob("*.html")) + list(ROOT.glob("*.js"))
    paths += list((ROOT / "apps").rglob("*.js"))
    paths += list((ROOT / "apps").rglob("*.html"))
    paths += [p for p in (ROOT / "email-template").rglob("*.html") if p.is_file()]
    return paths


def usages() -> dict[tuple[str, str], list[str]]:
    found: dict[tuple[str, str], list[str]] = {}
    for path in site_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in ICON_PAIR.finditer(text):
            found.setdefault((match.group(1), match.group(2)), []).append(path.name)
    return found


def test_regular_icons_exist_in_free_regular_set() -> None:
    bad = {
        f"fa-regular fa-{name} ({', '.join(sorted(set(files)))})"
        for (style, name), files in usages().items()
        if style == "regular" and name not in FA_FREE_REGULAR
    }
    assert not bad, (
        "icons requested as fa-regular have no glyph in the FA Free regular "
        "font and render blank — use fa-solid instead: " + "; ".join(sorted(bad))
    )


def test_brands_icons_exist_in_free_brands_set() -> None:
    bad = {
        f"fa-brands fa-{name} ({', '.join(sorted(set(files)))})"
        for (style, name), files in usages().items()
        if style == "brands" and name not in FA_FREE_BRANDS
    }
    assert not bad, (
        "brand icons not in the curated FA Free brands allowlist (verify "
        "against the FA metadata, then extend FA_FREE_BRANDS): "
        + "; ".join(sorted(bad))
    )


def test_pages_using_icons_load_font_awesome() -> None:
    for path in site_files():
        if not path.name.endswith(".html"):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if ICON_PAIR.search(text) and not FA_CSS.search(text):
            raise AssertionError(
                f"{path.name} renders Font Awesome icons but does not load "
                "the Font Awesome stylesheet"
            )


def test_no_legacy_fa_prefixes() -> None:
    bad = []
    for path in site_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        if LEGACY_PREFIX.search(text):
            bad.append(path.name)
    assert not bad, (
        "legacy fas/far/fab prefixes found — use fa-solid/fa-regular/"
        "fa-brands: " + ", ".join(sorted(set(bad)))
    )


def test_font_awesome_version_supports_all_used_icons() -> None:
    """x-twitter requires FA >= 6.4.2; keep the CDN version honest."""
    for path in site_files():
        if not path.name.endswith(".html"):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in re.finditer(r"font-awesome/(\d+)\.(\d+)\.(\d+)/", text):
            major, minor, patch = (int(group) for group in match.groups())
            assert (major, minor, patch) >= (6, 4, 2), (
                f"{path.name} loads Font Awesome {major}.{minor}.{patch}; "
                "fa-brands fa-x-twitter requires >= 6.4.2"
            )
