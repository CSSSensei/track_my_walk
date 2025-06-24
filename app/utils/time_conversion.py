from datetime import datetime


def unix_time_to_readable(unix_time: int) -> str:

    # Преобразует Unix time (секунды с 1970-01-01) в строку формата `dd.mm.yyyy hh:mm`
    dt_object = datetime.fromtimestamp(unix_time)
    formatted_date = dt_object.strftime("%d.%m.%Y %H:%M")
    return formatted_date
