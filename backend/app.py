import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from config import Config
from extensions import db

load_dotenv()
app = Flask(__name__)
app.config.from_object(Config)
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

db.init_app(app)
CORS(app)
jwt = JWTManager(app)

@app.route("/")
def home():
    return jsonify({"message": "Welcome to StudyCloud API!", "status": "Backend is running successfully"})

@app.route("/api/health")
def health():
    return jsonify({"status": "healthy", "application": "StudyCloud"})

from routes.auth import auth_bp
app.register_blueprint(auth_bp, url_prefix="/api/auth")
from routes.courses import courses_bp
app.register_blueprint(courses_bp, url_prefix="/api/courses")
from routes.tasks import tasks_bp
app.register_blueprint(tasks_bp, url_prefix="/api/tasks")
from routes.materials import materials_bp
app.register_blueprint(materials_bp, url_prefix="/api/materials")
from routes.dashboard import dashboard_bp
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
from routes.study import study_bp
app.register_blueprint(study_bp, url_prefix="/api/study")

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", debug=os.getenv("FLASK_DEBUG", "false").lower() == "true", port=5000)
