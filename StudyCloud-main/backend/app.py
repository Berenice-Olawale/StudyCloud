
import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

from extensions import db

load_dotenv()

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///studycloud.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
# Local file storage for development
app.config["UPLOAD_FOLDER"] = os.path.join(app.root_path, "uploads")

# Maximum upload size: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

db.init_app(app)
CORS(app)

jwt = JWTManager(app)


@app.route("/")
def home():
    return jsonify({
        "message": "Welcome to StudyCloud API!",
        "status": "Backend is running successfully"
    })


@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy",
        "application": "StudyCloud"
    })


# Register API routes
from routes.auth import auth_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")

from routes.courses import courses_bp

app.register_blueprint(courses_bp, url_prefix="/api/courses")

from routes.tasks import tasks_bp

app.register_blueprint(tasks_bp, url_prefix="/api/tasks")

from routes.materials import materials_bp

app.register_blueprint(
    materials_bp,
    url_prefix="/api/materials"
)

from routes.dashboard import dashboard_bp
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True, port=5000)
