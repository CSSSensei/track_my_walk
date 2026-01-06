from PIL import Image, ExifTags
import os
from flask import current_app


def _apply_exif_orientation(img: Image.Image) -> Image.Image:
    try:
        orientation_tag = None
        for tag in ExifTags.TAGS.keys():
            if ExifTags.TAGS[tag] == 'Orientation':
                orientation_tag = tag
                break

        if not orientation_tag:
            return img

        exif = img._getexif()
        if not exif or orientation_tag not in exif:
            return img

        orientation_value = exif[orientation_tag]

        if orientation_value == 3:
            return img.rotate(180, expand=True)
        if orientation_value == 6:
            return img.rotate(270, expand=True)
        if orientation_value == 8:
            return img.rotate(90, expand=True)

        return img
    except (AttributeError, KeyError, IndexError, TypeError):
        return img


def _normalize_for_web(img: Image.Image) -> Image.Image:
    img = _apply_exif_orientation(img)

    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    return img


def convert_image_to_webp(source_path: str, upload_folder: str, filename: str, quality: int = 82):
    name, _ext = os.path.splitext(filename)
    webp_filename = f"{name}.webp"
    webp_path = os.path.join(upload_folder, webp_filename)

    img = Image.open(source_path)
    img = _normalize_for_web(img)

    img.save(webp_path, "WEBP", quality=quality, method=6)

    if os.path.abspath(webp_path) != os.path.abspath(source_path) and os.path.exists(source_path):
        os.remove(source_path)

    webp_url = f"/static/uploads/photos/{webp_filename}"
    return webp_path, webp_url, webp_filename


def create_thumbnail(source_path, upload_folder, filename, profile=None):
    try:
        if profile is None:
            profile = current_app.config['DEFAULT_THUMBNAIL_PROFILE']

        config_photo = current_app.config['THUMBNAIL_PROFILES'][profile]

        name, _ext = os.path.splitext(filename)
        thumb_filename = f"{config_photo['prefix']}{name}{config_photo.get('suffix', '')}.webp"
        thumb_path = os.path.join(upload_folder, thumb_filename)

        img = Image.open(source_path)
        img = _normalize_for_web(img)

        img.thumbnail(config_photo['size'], Image.Resampling.LANCZOS)

        img.save(
            thumb_path,
            "WEBP",
            quality=config_photo['quality'],
            method=6,
        )

        thumb_url = f"/static/uploads/photos/{thumb_filename}"
        return thumb_path, thumb_url

    except KeyError:
        raise ValueError(f"Unknown thumbnail profile: {profile}")
    except Exception as e:
        if 'thumb_path' in locals() and os.path.exists(thumb_path):
            os.remove(thumb_path)
        raise e


def create_all_thumbnails(source_path, upload_folder, filename):
    results = {}
    for profile in current_app.config['THUMBNAIL_PROFILES'].keys():
        try:
            _, thumb_url = create_thumbnail(source_path, upload_folder, filename, profile)
            results[profile] = thumb_url
        except Exception as e:
            current_app.logger.error(f"Failed to create {profile} thumbnail: {str(e)}")
            results[profile] = None

    return results
