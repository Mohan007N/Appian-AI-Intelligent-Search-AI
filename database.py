from models import db
from flask import Flask

def init_db(app):
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        # Create admin user if not exists
        from models import User
        from werkzeug.security import generate_password_hash
        
        admin = User.query.filter_by(email='admin@appian-ai.com').first()
        if not admin:
            admin = User(
                email='admin@appian-ai.com',
                username='admin',
                full_name='System Administrator',
                role='admin'
            )
            admin.set_password('Admin@123')
            db.session.add(admin)
            db.session.commit()