from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_login import LoginManager, current_user, login_required
from flask_cors import CORS
import os
from config import Config
from database import init_db
from auth import auth_bp
from models import db, User, Document, SearchHistory, Analytics, Team, Integration
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import json

app = Flask(__name__, 
            static_folder='../static',
            template_folder='../templates')
app.config.from_object(Config)

# Initialize extensions
CORS(app)
init_db(app)

# Ensure upload folder exists (absolute path)
UPLOAD_FOLDER_ABS = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), app.config.get('UPLOAD_FOLDER', 'static/uploads')))
os.makedirs(UPLOAD_FOLDER_ABS, exist_ok=True)

# Helper to get upload folder
def get_upload_folder():
    return UPLOAD_FOLDER_ABS

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Register blueprints
app.register_blueprint(auth_bp)

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

# API Routes
@app.route('/api/search', methods=['POST'])
def search():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Authentication required'}), 401
    
    data = request.get_json()
    query = data.get('query', '')
    
    # Mock AI search results (in production, integrate with actual AI/ML model)
    results = [
        {
            'id': 1,
            'title': 'Customer Refund Policy v2.1',
            'content': f"Refund requests must be processed within {query} business days...",
            'relevance': 95,
            'doc_type': 'Policy',
            'department': 'Customer Service',
            'last_updated': '2024-01-15'
        },
        {
            'id': 2,
            'title': 'Compliance Guidelines for Financial Services',
            'content': f"All {query} transactions must comply with regulatory requirements...",
            'relevance': 87,
            'doc_type': 'Guideline',
            'department': 'Compliance',
            'last_updated': '2024-02-20'
        }
    ]
    
    # Save search history
    history = SearchHistory(
        query=query,
        results_count=len(results),
        user_id=current_user.id
    )
    db.session.add(history)
    db.session.commit()
    
    return jsonify({
        'results': results,
        'query_time': '0.45s',
        'total_results': len(results)
    })

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Authentication required'}), 401
    # Try to return analytics from DB if available
    latest = Analytics.query.order_by(Analytics.date.desc()).first()
    if latest:
        return jsonify({
            'daily_searches': latest.total_searches,
            'avg_response_time': latest.avg_response_time,
            'resolved_cases': latest.resolved_cases,
            'time_saved': latest.time_saved,
            'accuracy_rate': None,
            'top_queries': []
        })

    # Fallback mock analytics data
    analytics = {
        'daily_searches': 1245,
        'avg_response_time': 0.42,
        'resolved_cases': 89,
        'time_saved': 156.7,
        'accuracy_rate': 94.2,
        'top_queries': [
            {'query': 'refund policy', 'count': 45},
            {'query': 'compliance requirements', 'count': 38},
            {'query': 'customer escalation', 'count': 32}
        ]
    }

    return jsonify(analytics)

@app.route('/api/documents', methods=['GET'])
def get_documents():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Authentication required'}), 401
    
    documents = Document.query.filter_by(user_id=current_user.id).all()
    
    return jsonify([{
        'id': doc.id,
        'title': doc.title,
        'doc_type': doc.doc_type,
        'department': doc.department,
        'upload_date': doc.upload_date.strftime('%Y-%m-%d'),
        'access_count': doc.access_count
    } for doc in documents])


@app.route('/api/documents', methods=['POST'])
@login_required
def upload_document():
    # Accept multipart/form-data with 'file' and optional metadata
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    title = request.form.get('title') or file.filename
    doc_type = request.form.get('doc_type') or ''
    department = request.form.get('department') or ''

    filename = secure_filename(file.filename)
    save_path = os.path.join(get_upload_folder(), filename)
    # avoid overwrite by appending timestamp if exists
    if os.path.exists(save_path):
        name, ext = os.path.splitext(filename)
        filename = f"{name}_{int(datetime.utcnow().timestamp())}{ext}"
        save_path = os.path.join(get_upload_folder(), filename)

    file.save(save_path)

    doc = Document(
        title=title,
        filename=filename,
        doc_type=doc_type,
        department=department,
        user_id=current_user.id
    )
    db.session.add(doc)
    db.session.commit()

    return jsonify({'message': 'Upload successful', 'document': {
        'id': doc.id,
        'title': doc.title,
        'filename': doc.filename
    }}), 201


@app.route('/api/documents/<int:doc_id>/download', methods=['GET'])
@login_required
def download_document(doc_id):
    doc = Document.query.get_or_404(doc_id)
    # only owner or admin can download
    if doc.user_id != current_user.id and getattr(current_user, 'role', '') != 'admin':
        return jsonify({'error': 'Permission denied'}), 403

    folder = get_upload_folder()
    return send_from_directory(folder, doc.filename, as_attachment=True)


@app.route('/api/teams', methods=['GET', 'POST'])
@login_required
def teams():
    if request.method == 'GET':
        # teams owned by or containing the current user
        teams = Team.query.filter((Team.owner_id == current_user.id) | (Team.members.any(id=current_user.id))).all()
        return jsonify([{
            'id': t.id,
            'name': t.name,
            'description': t.description,
            'owner_id': t.owner_id,
            'member_count': len(t.members)
        } for t in teams])

    # POST -> create team
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Team name required'}), 400

    description = data.get('description', '')
    member_ids = data.get('members', [])

    team = Team(name=name, description=description, owner_id=current_user.id)
    if member_ids:
        users = User.query.filter(User.id.in_(member_ids)).all()
        for u in users:
            team.members.append(u)

    db.session.add(team)
    db.session.commit()

    return jsonify({'message': 'Team created', 'team': {'id': team.id, 'name': team.name}}), 201


@app.route('/api/integrations', methods=['GET', 'POST'])
@login_required
def integrations():
    if request.method == 'GET':
        items = Integration.query.all()
        return jsonify([{
            'id': it.id,
            'name': it.name,
            'type': it.type,
            'enabled': it.enabled,
            'config': it.config
        } for it in items])

    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Integration name required'}), 400

    itype = data.get('type')
    config = json.dumps(data.get('config', {})) if not isinstance(data.get('config', {}), str) else data.get('config', '')

    integ = Integration(name=name, type=itype, config=config, enabled=bool(data.get('enabled', True)))
    db.session.add(integ)
    db.session.commit()

    return jsonify({'message': 'Integration added', 'integration': {'id': integ.id, 'name': integ.name}}), 201

if __name__ == '__main__':
    app.run(debug=True, port=5000)