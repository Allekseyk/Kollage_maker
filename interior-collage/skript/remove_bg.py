import argparse
import sys
from pathlib import Path

from PIL import Image
from rembg import remove, new_session


SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def find_images(input_dir: Path) -> list[Path]:

	images: list[Path] = []
	for ext in SUPPORTED_EXTS:
		images.extend(sorted(input_dir.rglob(f"*{ext}")))
	return images


def process_image(src_path: Path, dst_path: Path, session) -> None:

	with Image.open(src_path) as img:
		# rembg вернет изображение с альфой (RGBA)
		result = remove(img, session=session)
		# Сохраняем в PNG, чтобы точно сохранить прозрачность
		dst_path.parent.mkdir(parents=True, exist_ok=True)
		result.save(dst_path, format="PNG")


def run(input_dir: Path, output_dir: Path, workers: int) -> None:

	if not input_dir.exists() or not input_dir.is_dir():
		raise SystemExit(f"Входная папка не найдена: {input_dir}")

	output_dir.mkdir(parents=True, exist_ok=True)

	images = find_images(input_dir)
	if not images:
		print("Изображения не найдены. Поддерживаемые расширения: .png .jpg .jpeg .webp .bmp")
		return

	# Инициализируем сессию rembg один раз для ускорения
	session = new_session()

	processed = 0
	failed = 0
	for idx, src in enumerate(images, start=1):
		# Сохраняем структуру подпапок относительно input_dir
		rel_path = src.relative_to(input_dir)
		# Меняем расширение на .png, чтобы сохранить альфу
		dst = output_dir / rel_path.with_suffix(".png")
		try:
			process_image(src, dst, session)
			processed += 1
			print(f"[{idx}/{len(images)}] OK: {src} -> {dst}")
		except Exception as e:
			failed += 1
			print(f"[{idx}/{len(images)}] FAIL: {src} | {e}")

	print("\nГотово.")
	print(f"Успешно: {processed}")
	print(f"Ошибок:   {failed}")


def parse_args(argv: list[str]) -> argparse.Namespace:

	script_dir = Path(__file__).resolve().parent
	default_input = script_dir / "1"
	default_output = script_dir / "2"

	parser = argparse.ArgumentParser(
		description="Пакетное удаление фона у изображений (rembg)",
		formatter_class=argparse.ArgumentDefaultsHelpFormatter,
	)
	parser.add_argument(
		"--input",
		"-i",
		type=Path,
		default=default_input,
		help="Папка с исходными изображениями",
	)
	parser.add_argument(
		"--output",
		"-o",
		type=Path,
		default=default_output,
		help="Папка для сохранения результатов (PNG с прозрачностью)",
	)
	parser.add_argument(
		"--workers",
		"-w",
		type=int,
		default=1,
		help="Зарезервировано. Сейчас обрабатывается последовательно",
	)
	return parser.parse_args(argv)


def main(argv: list[str]) -> int:

	args = parse_args(argv)
	try:
		run(args.input, args.output, args.workers)
	except SystemExit as e:
		print(e)
		return 1
	except Exception as e:
		print(f"Неожиданная ошибка: {e}")
		return 2
	return 0


if __name__ == "__main__":
	sys.exit(main(sys.argv[1:]))


