from app import create_app

app = create_app()

if __name__ == '__main__':
    # You can run initial DB setup here or use a separate script/Flask CLI command
    # database.init_db(app) # Already called in create_app() for convenience
    app.run(debug=True)
