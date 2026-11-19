"""Extract the private review bundle into an external staging input directory."""
from html.parser import HTMLParser
from pathlib import Path
import re
from sys import argv
from urllib.parse import urlsplit
from zipfile import ZipFile

class ManuscriptValidator(HTMLParser):
    tags = set("a br em h1 h2 h3 hr li ol p strong table tbody td th thead tr ul".split())

    def handle_starttag(self, tag, attrs):
        if tag not in self.tags:
            raise ValueError(f"Unsupported manuscript tag: {tag}")
        for name, value in attrs:
            if tag == "ol" and name == "start" and (value or "").isdigit():
                continue
            if tag != "a" or name != "href" or urlsplit(value or "").scheme not in {"http", "https"}:
                raise ValueError(f"Unsupported manuscript attribute: {tag}.{name}")

    def handle_endtag(self, tag):
        if tag not in self.tags:
            raise ValueError(f"Unsupported manuscript end tag: {tag}")

    def handle_decl(self, decl):
        raise ValueError(f"Unexpected manuscript declaration: {decl}")

# Recovered PDF text uses separate paragraph tags for some wrapped lines.
# Join only plain-text fragments with a lowercase continuation and no sentence ending.
wrapped_line = re.compile(r"(<p>[^<>]*[^<>.!?…:;)\s])</p>\s*<p>([a-z][^<>]*)</p>")

def join_wrapped_lines(body):
    while True:
        body, count = wrapped_line.subn(r"\1 \2</p>", body)
        if not count:
            return body

archive, destination = argv[1:]
destination = Path(destination)
assets = destination / "assets"
assets.mkdir(parents=True, exist_ok=True)
slugs = ["opening", *(f"part-{part:02}" for part in range(1, 9)), "closing"]
with ZipFile(archive) as bundle:
    manuscripts = {}
    for slug in slugs:
        page = bundle.read(f"{slug}.html").decode()
        body = page.split('<div class="article">', 1)[1].split('</div><a class="back"', 1)[0]
        ManuscriptValidator().feed(body)
        # The Next.js route supplies the primary heading.
        if slug in {"part-01", "part-02", "part-04", "part-05", "part-06", "part-07"}:
            body = join_wrapped_lines(body)
        manuscripts[slug] = body.replace("<h1>", "<h2>").replace("</h1>", "</h2>")

    pictures = [name for name in bundle.namelist() if name.startswith("assets/") and name.endswith(".png")]
    if len(pictures) != 9:
        raise ValueError("Expected nine section illustrations")
    for name in pictures:
        (assets / Path(name).name).write_bytes(bundle.read(name))
    for slug, body in manuscripts.items():
        (destination / f"{slug}.html").write_text(body, encoding="utf-8")

artwork = Path(__file__).with_name("outlook-artwork") / "strategic-outlook-cover.webp"
(assets / artwork.name).write_bytes(artwork.read_bytes())
