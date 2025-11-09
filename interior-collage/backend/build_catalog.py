import os
import re
import csv
import sqlite3
from typing import Dict, Optional, List
from pathlib import Path
import sys

from sqlmodel import SQLModel, create_engine, Session

# Import Product model when run as a script or module
try:
	from .models import Product  # type: ignore
except Exception:
	# Fallback: add parent folder to sys.path and import
	CURRENT_DIR = Path(__file__).resolve().parent
	PARENT_DIR = CURRENT_DIR
	if str(PARENT_DIR) not in sys.path:
		sys.path.insert(0, str(PARENT_DIR))
	from models import Product  # type: ignore

import requests
import random

# Unwanted category fragments (case-insensitive substring match)
EXCLUDED_CATEGORY_FRAGMENTS = {
	"инженерная сантехника",
	"отопительное оборудование",
	"климатическое оборудование",
	"товары для уборки",
	"уход и гигиена",
	"вода и водоочистка",
	"товары для дачи",
	"товары для бани и сауны",
	"бытовая техника",
	"интерьеры с плиткой",
	"товары для ремонта",
}

MAX_IMAGE_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_BYTES", str(6 * 1024 * 1024)))  # 6 MB cap
PER_CATEGORY_LIMIT = int(os.getenv("PER_CATEGORY_LIMIT", "20"))
TOTAL_LIMIT = int(os.getenv("TOTAL_LIMIT", "400"))  # overall cap on saved products
RANDOM_SEED = os.getenv("RANDOM_SEED")
if RANDOM_SEED is not None:
	try:
		random.seed(int(RANDOM_SEED))
	except Exception:
		random.seed(RANDOM_SEED)


def has_image(url: Optional[str]) -> bool:
	if not url:
		return False
	u = url.strip()
	if not u:
		return False
	# Simple sanity checks
	if not (u.startswith("http://") or u.startswith("https://")):
		return False
	return True


def download_image_bytes(url: str, session: Optional[requests.Session] = None) -> Optional[bytes]:
	s = session or requests.Session()
	try:
		# Try a quick HEAD first to fail fast on huge payloads
		try:
			h = s.head(url, timeout=5, allow_redirects=True)
			cl = h.headers.get("Content-Length")
			if cl and int(cl) > MAX_IMAGE_SIZE_BYTES:
				return None
		except Exception:
			pass  # not fatal; proceed to GET

		with s.get(url, timeout=7, stream=True) as r:
			r.raise_for_status()
			content_type = (r.headers.get("Content-Type") or "").lower()

			# Accept common cases even when servers mislabel images
			looks_like_image = any(url.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"])
			if ("image" not in content_type) and ("octet-stream" not in content_type) and not looks_like_image:
				return None

			buf = bytearray()
			for chunk in r.iter_content(chunk_size=8192):
				if not chunk:
					break
				buf.extend(chunk)
				if len(buf) > MAX_IMAGE_SIZE_BYTES:
					return None
			return bytes(buf) if buf else None
	except Exception:
		return None


def extract_id_from_url(url: str) -> Optional[str]:
	match = re.search(r"/(\d+)/?$", url.strip())
	return match.group(1) if match else None


def read_csv_products(csv_path: Path) -> Dict[str, Dict[str, Optional[str]]]:
	products: Dict[str, Dict[str, Optional[str]]] = {}
	with csv_path.open("r", encoding="utf-8", newline="") as f:
		reader = csv.DictReader(f, delimiter=";")
		# Normalize headers (strip quotes/spaces)
		headers = {h: h.strip().strip('"') for h in reader.fieldnames or []}
		for row in reader:
			# Some exporters wrap values in quotes; strip them
			clean = {headers.get(k, k): (v.strip().strip('"') if isinstance(v, str) else v) for k, v in row.items()}
			url = clean.get("Ссылка на сайт") or ""
			pid = extract_id_from_url(url) or clean.get("Артикул") or ""
			if not pid:
				continue
			name = clean.get("Название") or ""
			brand = clean.get("Бренд") or None
			image_url = clean.get("Изображение") or ""
			if not name:
				continue
			products[pid] = {
				"name": name,
				"brand": brand,
				"image_url": image_url or None,
			}
	return products


def try_parse_xml(xml_path: Path) -> Dict[str, Dict[str, Optional[str]]]:
	"""Best-effort streaming parse of common YML/XML (categories/offers).
	Returns map: offer_id -> {category, color}
	"""
	from xml.etree.ElementTree import iterparse

	result: Dict[str, Dict[str, Optional[str]]] = {}
	category_by_id: Dict[str, str] = {}

	# First pass: categories (if present)
	try:
		for event, elem in iterparse(xml_path, events=("start", "end")):
			if event == "end" and elem.tag.lower().endswith("category"):
				cat_id = elem.get("id")
				name = (elem.text or "").strip()
				if cat_id and name:
					category_by_id[cat_id] = name
				# Free memory
				elem.clear()
	except Exception:
		# XML may be too big or different format; we'll just skip
		pass

	# Second pass: offers
	try:
		current_offer_id: Optional[str] = None
		current_category_id: Optional[str] = None
		current_color: Optional[str] = None
		for event, elem in iterparse(xml_path, events=("start", "end")):
			tag = elem.tag.lower()
			if event == "start" and tag.endswith("offer"):
				current_offer_id = elem.get("id") or None
				current_category_id = None
				current_color = None
			elif event == "end":
				if tag.endswith("categoryid"):
					text = (elem.text or "").strip()
					if text:
						current_category_id = text
				elif tag.endswith("param"):
					# Looking for color param (common: name="Цвет")
					param_name = (elem.get("name") or elem.get("Name") or "").strip().lower()
					if param_name in {"цвет", "color", "color name"}:
						val = (elem.text or "").strip()
						if val:
							current_color = val
				elif tag.endswith("offer"):
					if current_offer_id:
						category = category_by_id.get(current_category_id or "", None)
						result[current_offer_id] = {"category": category, "color": current_color}
					# Clear and reset
					elem.clear()
					current_offer_id = None
					current_category_id = None
					current_color = None
	except Exception:
		# Best-effort only
		pass

	return result


def ensure_db_schema(db_path: Path) -> Session:
	engine = create_engine(f"sqlite:///{db_path}", echo=False)
	SQLModel.metadata.create_all(engine)
	return Session(engine)


def build_catalog(shared_dir: Path, out_db: Path) -> None:
	csv_file = shared_dir / "Экспорт раздела Весь каталог.csv"
	xml_file = shared_dir / "Экспорт раздела Весь каталог.xml"

	csv_map = read_csv_products(csv_file)
	xml_map: Dict[str, Dict[str, Optional[str]]] = {}
	if xml_file.exists():
		xml_map = try_parse_xml(xml_file)

	# Prepare output DB
	if out_db.exists():
		out_db.unlink()
	session = ensure_db_schema(out_db)

	# Insert products
	seen_names = set()
	candidates_by_category: Dict[str, List[Dict[str, Optional[str]]]] = {}
	skipped_no_category = 0
	skipped_excluded_category = 0
	skipped_no_image_url = 0
	for pid, data in csv_map.items():
		name = data.get("name") or ""
		if name in seen_names:
			continue
		seen_names.add(name)

		x = xml_map.get(pid, {})
		category = x.get("category") or data.get("brand") or None
		color = x.get("color") or None
		image_url = data.get("image_url") or None

		# Filter rules before sampling
		if not category:
			skipped_no_category += 1
			continue
		if any(excl in category.lower() for excl in EXCLUDED_CATEGORY_FRAGMENTS):
			skipped_excluded_category += 1
			continue
		if not has_image(image_url):
			skipped_no_image_url += 1
			continue

		candidates_by_category.setdefault(category, []).append({
			"name": name,
			"category": category,
			"color": color,
			"image_url": image_url,
		})

	# Random sampling per category
	selected: List[Dict[str, Optional[str]]] = []
	for cat, items in candidates_by_category.items():
		if len(items) <= PER_CATEGORY_LIMIT:
			selected.extend(items)
		else:
			selected.extend(random.sample(items, PER_CATEGORY_LIMIT))

	# Download and insert only selected
	to_add: List[Product] = []
	download_failed = 0
	req_session = requests.Session()
	for item in selected:
		if len(to_add) >= TOTAL_LIMIT:
			break
		image_bytes = download_image_bytes(item["image_url"] or "", session=req_session)
		if not image_bytes:
			download_failed += 1
			continue
		product = Product(
			name=item["name"] or "",
			category=item["category"],
			image_url=item["image_url"] or "",
			image_blob=image_bytes,
			color=item["color"],
			tags=None,
		)
		to_add.append(product)

	# Bulk save
	for chunk_start in range(0, len(to_add), 1000):
		chunk = to_add[chunk_start:chunk_start + 1000]
		session.add_all(chunk)
		session.commit()

	print(
		f"Saved {len(to_add)} products to {out_db}. "
		f"Skipped: no_category={skipped_no_category}, excluded_category={skipped_excluded_category}, "
		f"no_image_url={skipped_no_image_url}, download_failed={download_failed}."
	)


if __name__ == "__main__":
	root = Path(__file__).resolve().parents[1]
	shared = root / "shared"
	out = shared / "catalog.db"
	build_catalog(shared, out)
