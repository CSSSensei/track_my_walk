from PIL import Image, ExifTags
import os
from flask import current_app


def create_thumbnail(source_path, upload_folder, filename, profile=None):
    """
    Создает миниатюру изображения по указанному профилю

    :param source_path: Полный путь к исходному изображению
    :param upload_folder: Папка для сохранения миниатюры
    :param filename: Имя исходного файла (без пути)
    :param profile: Ключ профиля из конфига (если None - используется DEFAULT_THUMBNAIL_PROFILE)
    :return: Кортеж (путь к миниатюре, URL миниатюры)
    """
    try:
        if profile is None:
            profile = current_app.config['DEFAULT_THUMBNAIL_PROFILE']

        config_photo = current_app.config['THUMBNAIL_PROFILES'][profile]

        name, ext = os.path.splitext(filename)
        thumb_filename = f"{config_photo['prefix']}{name}{config_photo.get('suffix', '')}.jpg"
        thumb_path = os.path.join(upload_folder, thumb_filename)

        img = Image.open(source_path)
        try:
            for orientation in ExifTags.TAGS.keys():
                if ExifTags.TAGS[orientation] == 'Orientation':
                    break

            exif = img._getexif()
            if exif and orientation in exif:
                orientation_value = exif[orientation]

                # Поворачиваем изображение в соответствии с ориентацией
                if orientation_value == 3:
                    img = img.rotate(180, expand=True)
                elif orientation_value == 6:
                    img = img.rotate(270, expand=True)
                elif orientation_value == 8:
                    img = img.rotate(90, expand=True)
        except (AttributeError, KeyError, IndexError):
            # Нет EXIF данных или ошибка при обработке
            pass

        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        img.thumbnail(config_photo['size'], Image.Resampling.LANCZOS)

        img.save(
            thumb_path,
            config_photo['format'],
            quality=config_photo['quality']
        )

        thumb_url = f'/static/uploads/photos/{thumb_filename}'

        return thumb_path, thumb_url

    except KeyError:
        raise ValueError(f"Unknown thumbnail profile: {profile}")
    except Exception as e:
        if 'thumb_path' in locals() and os.path.exists(thumb_path):
            os.remove(thumb_path)
        raise e


def create_all_thumbnails(source_path, upload_folder, filename):
    """
    Создает все варианты миниатюр для изображения

    :return: Словарь {профиль: url_миниатюры}
    """
    results = {}
    for profile in current_app.config['THUMBNAIL_PROFILES'].keys():
        try:
            _, thumb_url = create_thumbnail(source_path, upload_folder, filename, profile)
            results[profile] = thumb_url
        except Exception as e:
            current_app.logger.error(f"Failed to create {profile} thumbnail: {str(e)}")
            results[profile] = None

    return results


if __name__ == '__main__':
    print(create_thumbnail(r'C:\Users\tomin\PycharmProjects\track_my_walk\app\static\uploads\photos\yan-photo.jpg', r'C:\Users\tomin\PycharmProjects\track_my_walk\app\static\uploads\photos', 'yan-photo', 'small'))
