class Walk:
    def __init__(self, id, name, date, description, path_geojson, co2_saved):
        self.id = id
        self.name = name
        self.date = date
        self.description = description
        self.path_geojson = path_geojson
        self.co2_saved = co2_saved

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'date': self.date,
            'description': self.description,
            'path_geojson': self.path_geojson,
            'co2_saved': self.co2_saved
        }
