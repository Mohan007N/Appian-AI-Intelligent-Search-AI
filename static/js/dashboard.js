class Dashboard {
    constructor() {
        this.initEventListeners();
        this.loadUserData();
        this.initCharts();
    }
    
    initEventListeners() {
        // Sidebar toggle
        document.querySelector('.sidebar-toggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });
        
        // Notifications panel
        document.getElementById('notificationsBtn').addEventListener('click', () => {
            document.getElementById('notificationsPanel').classList.toggle('active');
        });
        
        document.getElementById('closeNotifications').addEventListener('click', () => {
            document.getElementById('notificationsPanel').classList.remove('active');
        });
        
        // Upload modal
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('uploadModal').classList.add('active');
        });
        
        document.getElementById('closeModal').addEventListener('click', () => {
            document.getElementById('uploadModal').classList.remove('active');
        });
        
        // Voice search
        document.getElementById('voiceSearchBtn').addEventListener('click', this.startVoiceSearch.bind(this));
        
        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
        
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }
    
    async loadUserData() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const user = await response.json();
                this.updateUserInterface(user);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }
    
    updateUserInterface(user) {
        // Update user profile in sidebar
        document.getElementById('userName').textContent = user.full_name || user.username;
        document.getElementById('userRole').textContent = user.role === 'admin' ? 'Administrator' : 'User';
        
        // Update avatar based on user initials
        if (!user.avatar) {
            const initials = (user.full_name || user.username)
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase();
            
            const colors = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ef4444'];
            const color = colors[initials.charCodeAt(0) % colors.length];
            
            document.getElementById('userAvatar').style.backgroundColor = color;
            document.getElementById('userAvatar').innerHTML = `<span>${initials}</span>`;
        }
    }
    
    initCharts() {
        // Initialize performance chart
        const ctx = document.getElementById('performanceChart');
        if (ctx) {
            new Chart(ctx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Searches',
                        data: [856, 1023, 1245, 987, 1321, 845, 923],
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }
    
    startVoiceSearch() {
        const voiceBtn = document.getElementById('voiceSearchBtn');
        const searchInput = document.getElementById('aiSearchInput');
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice search is not supported in your browser.');
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        voiceBtn.classList.add('recording');
        voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
        
        recognition.start();
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            searchInput.value = transcript;
            voiceBtn.classList.remove('recording');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            voiceBtn.classList.remove('recording');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        };
        
        recognition.onend = () => {
            voiceBtn.classList.remove('recording');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        };
    }
    
    handleFiles(files) {
        const progressContainer = document.getElementById('uploadProgress');
        progressContainer.innerHTML = '';
        
        Array.from(files).forEach((file, index) => {
            if (!file.type.match('text.*') && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
                alert(`File ${file.name} is not a supported document type.`);
                return;
            }
            
            const progressItem = document.createElement('div');
            progressItem.className = 'progress-item';
            progressItem.innerHTML = `
                <div class="progress-info">
                    <span>${file.name}</span>
                    <span class="progress-percent">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            `;
            
            progressContainer.appendChild(progressItem);
            
            // Simulate upload progress
            this.simulateUpload(progressItem, file, index * 500);
        });
    }
    
    simulateUpload(progressItem, file, delay) {
        setTimeout(() => {
            const percentSpan = progressItem.querySelector('.progress-percent');
            const fillBar = progressItem.querySelector('.progress-fill');
            
            let percent = 0;
            const interval = setInterval(() => {
                percent += Math.random() * 10;
                if (percent >= 100) {
                    percent = 100;
                    clearInterval(interval);
                    
                    // Show success state
                    setTimeout(() => {
                        progressItem.classList.add('success');
                        percentSpan.innerHTML = '<i class="fas fa-check"></i>';
                        
                        // Refresh documents list
                        setTimeout(() => {
                            this.loadDocuments();
                        }, 1000);
                    }, 500);
                }
                
                percentSpan.textContent = Math.round(percent) + '%';
                fillBar.style.width = percent + '%';
            }, 100);
        }, delay);
    }
    
    async loadDocuments() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/documents', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const documents = await response.json();
                this.renderDocuments(documents);
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
        }
    }
    
    renderDocuments(documents) {
        const container = document.getElementById('documentsList');
        
        if (documents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>No documents uploaded yet</h3>
                    <p>Upload your first policy document to get started</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = documents.map(doc => `
            <div class="document-card" data-id="${doc.id}">
                <div class="document-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="document-info">
                    <h4>${doc.title}</h4>
                    <p>${doc.department} • ${doc.doc_type}</p>
                    <div class="document-meta">
                        <span><i class="fas fa-calendar"></i> ${doc.upload_date}</span>
                        <span><i class="fas fa-eye"></i> ${doc.access_count} views</span>
                    </div>
                </div>
                <div class="document-actions">
                    <button class="btn-icon view-doc" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon download-doc" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to document actions
        container.querySelectorAll('.view-doc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const docCard = e.target.closest('.document-card');
                const docId = docCard.dataset.id;
                this.viewDocument(docId);
            });
        });
        
        container.querySelectorAll('.download-doc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const docCard = e.target.closest('.document-card');
                const docId = docCard.dataset.id;
                this.downloadDocument(docId);
            });
        });
    }
    
    async viewDocument(docId) {
        // Show document viewer modal
        console.log('View document:', docId);
        // In production, this would open a document viewer
    }
    
    async downloadDocument(docId) {
        // Implement document download
        console.log('Download document:', docId);
        // In production, this would trigger a file download
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});