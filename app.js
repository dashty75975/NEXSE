// NEXŞE - Main Application JavaScript
// Real-time vehicle tracking with Leaflet and Firebase

class IraqVehicleTracker {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.userMarker = null;
        this.vehicleMarkers = new Map();
        this.markerCluster = null;
        this.currentDriver = null;
        this.currentAdmin = null;
        this.activeFilters = new Set(['taxi', 'minibus', 'tuk-tuk', 'van', 'bus']); // Restored: Vehicle filtering
        this.iraqCenter = [33.3152, 44.3661];
        this.autoLocationUpdate = false; // New: Auto location update preference
        this.locationPermissionDenied = false; // Track permission status
        
        // Initialize email service
        this.emailService = new EmailService();
        
        // Dashboard properties
        this.dashboardCharts = {
            vehicleChart: null,
            registrationChart: null,
            activityChart: null
        };
        this.dashboardStats = {
            totalDrivers: 0,
            onlineDrivers: 0,
            pendingApprovals: 0,
            emailsSent: 0
        };
        
        this.init();
    }

    async init() {
        try {
            this.initMap();
            this.setupEventListeners();
            await this.loadVehicleTypes(); // Restored: Load vehicle filter icons
            await this.loadVehicles();
            this.setupRealtimeListeners();
            this.loadAboutContent(); // Load about content on page load
            console.log('NEXŞE initialized');
        } catch (error) {
            console.error('Error initializing:', error);
            this.showMessage('Error initializing NEXŞE', 'danger');
        }
    }

    initMap() {
        this.map = L.map('map').setView(this.iraqCenter, 6);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        this.markerCluster = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50
        });
        this.map.addLayer(this.markerCluster);
        
        // Add Iraq boundary
        const iraqLayer = L.geoJSON(IRAQ_BOUNDARY, {
            style: { color: '#e53935', weight: 2, opacity: 0.6, fillOpacity: 0.1 }
        }).addTo(this.map);
        this.map.fitBounds(iraqLayer.getBounds());
    }

    setupEventListeners() {
        // Registration form
        document.getElementById('registration-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegistration();
        });

        // Driver login
        document.getElementById('driver-login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDriverLogin();
        });

        // Admin login
        document.getElementById('admin-login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAdminLogin();
        });

        // Vehicle type selector
        document.getElementById('vehicle-type').addEventListener('change', (e) => {
            this.toggleVehicleTypeFields(e.target.value);
        });

        // Removed: radius slider - no longer needed

        // Online toggle
        document.getElementById('online-toggle').addEventListener('change', (e) => {
            this.toggleDriverOnlineStatus(e.target.checked);
        });
    }

    showSection(sectionName) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${sectionName}-section`).classList.add('active');
        
        if (sectionName === 'map') {
            setTimeout(() => this.map.invalidateSize(), 100);
        }
    }

    async loadVehicleTypes() {
        const vehicleTypes = [
            { id: 'taxi', icon: '🚕', name: 'Taxi', enabled: true },
            { id: 'minibus', icon: '🚐', name: 'Minibus', enabled: true },
            { id: 'tuk-tuk', icon: '🛺', name: 'Tuk-tuk', enabled: true },
            { id: 'van', icon: '🚐', name: 'Van', enabled: true },
            { id: 'bus', icon: '🚌', name: 'Bus', enabled: true }
        ];
        this.createVehicleFilters(vehicleTypes);
    }

    createVehicleFilters(vehicleTypes) {
        const container = document.getElementById('vehicle-filters');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Add "All" button (no text, just icon)
        const allBtn = this.createFilterButton('all', '🚗', 'All Vehicles', true);
        allBtn.classList.add('all-btn');
        container.appendChild(allBtn);
        
        // Add vehicle type buttons (icons only)
        vehicleTypes.forEach(type => {
            if (type.enabled) {
                const btn = this.createFilterButton(type.id, type.icon, type.name, true);
                container.appendChild(btn);
            }
        });
    }

    createFilterButton(type, icon, name, active = false) {
        const button = document.createElement('button');
        button.className = `filter-btn ${active ? 'active' : ''}`;
        button.innerHTML = icon; // Only icon, no text!
        button.title = name; // Tooltip shows the name
        button.onclick = () => this.toggleVehicleFilter(type, button);
        return button;
    }

    toggleVehicleFilter(type, button) {
        if (type === 'all') {
            const allActive = button.classList.contains('active');
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', !allActive);
            });
            if (allActive) {
                this.activeFilters.clear();
            } else {
                this.activeFilters = new Set(['taxi', 'minibus', 'tuk-tuk', 'van', 'bus']);
            }
        } else {
            button.classList.toggle('active');
            if (button.classList.contains('active')) {
                this.activeFilters.add(type);
            } else {
                this.activeFilters.delete(type);
            }
        }
        this.filterVehicles();
    }

    async handleRegistration() {
        try {
            const formData = this.getRegistrationFormData();
            
            if (!this.validateRegistrationData(formData)) return;
            
            const location = await this.getCurrentLocation();
            
            if (!isPointInIraq(location.lat, location.lng)) {
                this.showMessage('Registration only available within Iraq', 'danger', 'registration-message');
                return;
            }
            
            formData.location = location;
            formData.country = 'IQ';
            formData.approved = false;
            formData.online = false;
            formData.registeredAt = Date.now();
            
            await this.registerDriver(formData);
            this.showMessage('Registration submitted! Wait for approval.', 'success', 'registration-message');
            document.getElementById('registration-form').reset();
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Registration failed', 'danger', 'registration-message');
        }
    }

    getRegistrationFormData() {
        return {
            name: document.getElementById('driver-name').value.trim(),
            email: document.getElementById('driver-email').value.trim(),
            phone: document.getElementById('driver-phone').value.trim(),
            licenseNumber: document.getElementById('license-number').value.trim(),
            plate: document.getElementById('vehicle-plate').value.trim(),
            vehicleType: document.getElementById('vehicle-type').value,
            routeFrom: document.getElementById('route-from').value.trim(),
            routeTo: document.getElementById('route-to').value.trim(),
            taxiNumber: document.getElementById('taxi-number').value.trim(),
            password: document.getElementById('driver-password').value
        };
    }

    validateRegistrationData(data) {
        if (!data.name || !data.email || !data.phone || !data.licenseNumber || 
            !data.plate || !data.vehicleType || !data.password) {
            this.showMessage('Please fill all required fields', 'danger', 'registration-message');
            return false;
        }
        
        if (data.vehicleType === 'bus' && (!data.routeFrom || !data.routeTo)) {
            this.showMessage('Bus drivers must specify routes', 'danger', 'registration-message');
            return false;
        }
        
        return true;
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                pos => {
                    this.locationPermissionDenied = false;
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        timestamp: Date.now()
                    });
                },
                error => {
                    console.error('Geolocation error:', error);
                    if (error.code === error.PERMISSION_DENIED) {
                        this.locationPermissionDenied = true;
                    }
                    reject(error);
                },
                { 
                    enableHighAccuracy: false, // Changed to false to avoid frequent prompts
                    timeout: 15000,
                    maximumAge: 300000 // Use cached location for 5 minutes
                }
            );
        });
    }

    async registerDriver(driverData) {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        driverData.id = Date.now().toString();
        drivers.push(driverData);
        localStorage.setItem('drivers', JSON.stringify(drivers));
        
        // Send welcome email to the new driver
        try {
            const emailResult = await this.emailService.sendWelcomeEmail(driverData);
            if (emailResult.success) {
                console.log('Welcome email sent successfully');
                this.dashboardStats.emailsSent++;
            } else {
                console.error('Failed to send welcome email:', emailResult.error);
            }
        } catch (error) {
            console.error('Error sending welcome email:', error);
        }
        
        // Send admin notification
        try {
            const adminNotificationResult = await this.emailService.sendAdminNotification(driverData);
            if (adminNotificationResult.success) {
                console.log('Admin notification sent successfully');
                this.dashboardStats.emailsSent++;
            } else {
                console.error('Failed to send admin notification:', adminNotificationResult.error);
            }
        } catch (error) {
            console.error('Error sending admin notification:', error);
        }
    }

    async handleDriverLogin() {
        try {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                this.showMessage('Enter email and password', 'danger', 'login-message');
                return;
            }
            
            const driver = await this.authenticateDriver(email, password);
            
            if (driver) {
                if (!driver.approved) {
                    this.showMessage('Account pending approval', 'warning', 'login-message');
                    return;
                }
                
                this.currentDriver = driver;
                this.showDriverDashboard();
            } else {
                this.showMessage('Invalid credentials', 'danger', 'login-message');
            }
        } catch (error) {
            this.showMessage('Login failed', 'danger', 'login-message');
        }
    }

    async authenticateDriver(email, password) {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        return drivers.find(d => d.email === email && d.password === password);
    }

    showDriverDashboard() {
        document.getElementById('driver-login').style.display = 'none';
        document.getElementById('driver-dashboard').style.display = 'block';
        this.updateDriverStatus();
        this.addLocationUpdateControls();
    }

    addLocationUpdateControls() {
        const infoContainer = document.getElementById('driver-info');
        if (!infoContainer) return;
        
        infoContainer.innerHTML = `
            <div class="form-group">
                <strong>Name:</strong> ${this.currentDriver.name || 'Unknown'}
            </div>
            <div class="form-group">
                <strong>Email:</strong> ${this.currentDriver.email || 'N/A'}
            </div>
            <div class="form-group">
                <strong>Vehicle Type:</strong> ${this.currentDriver.vehicleType || 'Unknown'}
            </div>
            <div class="form-group">
                <strong>Plate:</strong> ${this.currentDriver.plate || 'Unknown'}
            </div>
            <div class="form-group">
                <strong>Location:</strong> ${this.currentDriver.location ? 
                    `${this.currentDriver.location.lat.toFixed(4)}, ${this.currentDriver.location.lng.toFixed(4)}` : 
                    'Not set'}
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="auto-location-toggle" ${this.autoLocationUpdate ? 'checked' : ''}>
                    <span>Auto-update location every 2 minutes</span>
                </label>
                <small style="color: #666;">When enabled, your location will update automatically while online</small>
            </div>
        `;
        
        // Add event listener for auto-update toggle
        const autoToggle = document.getElementById('auto-location-toggle');
        if (autoToggle) {
            autoToggle.addEventListener('change', (e) => {
                this.autoLocationUpdate = e.target.checked;
                const message = this.autoLocationUpdate ? 
                    'Auto location updates enabled' : 
                    'Auto location updates disabled';
                this.showMessage(message, 'success');
            });
        }
    }

    updateDriverStatus() {
        const statusEl = document.getElementById('driver-status');
        const toggle = document.getElementById('online-toggle');
        
        if (this.currentDriver.online) {
            statusEl.className = 'status-indicator status-online';
            statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Online</span>';
            toggle.checked = true;
        } else {
            statusEl.className = 'status-indicator status-offline';
            statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Offline</span>';
            toggle.checked = false;
        }
    }

    async toggleDriverOnlineStatus(online) {
        try {
            if (online) {
                const location = await this.getCurrentLocation();
                if (!isPointInIraq(location.lat, location.lng)) {
                    this.showMessage('Must be in Iraq to go online', 'danger');
                    document.getElementById('online-toggle').checked = false;
                    return;
                }
                this.currentDriver.location = location;
            }
            
            this.currentDriver.online = online;
            this.currentDriver.lastSeen = Date.now();
            await this.updateDriverData(this.currentDriver);
            this.updateDriverStatus();
            
        } catch (error) {
            this.showMessage('Failed to update status', 'danger');
            document.getElementById('online-toggle').checked = !online;
        }
    }

    async updateDriverData(driver) {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const index = drivers.findIndex(d => d.id === driver.id);
        if (index !== -1) {
            drivers[index] = driver;
            localStorage.setItem('drivers', JSON.stringify(drivers));
        }
    }

    async loadVehicles() {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const approved = drivers.filter(d => d.approved);
        this.displayVehiclesOnMap(approved);
    }

    displayVehiclesOnMap(drivers) {
        this.markerCluster.clearLayers();
        this.vehicleMarkers.clear();
        
        drivers.forEach(driver => {
            if (driver.location && driver.online) {
                this.addVehicleMarker(driver);
            }
        });
    }

    addVehicleMarker(driver) {
        const { lat, lng } = driver.location;
        const icon = this.getVehicleIcon(driver.vehicleType, driver);
        
        const marker = L.marker([lat, lng], { icon })
            .bindPopup(this.createVehiclePopup(driver));
        
        this.markerCluster.addLayer(marker);
        this.vehicleMarkers.set(driver.id, marker);
    }

    getVehicleIcon(vehicleType, driver = null) {
        const icons = {
            taxi: '🚕',
            minibus: '🚐',
            'tuk-tuk': '🛺',
            van: '🚐',
            bus: '🚌'
        };
        
        let iconHtml = `<div class="vehicle-icon-no-bg">${icons[vehicleType] || '🚗'}</div>`;
        
        // Add route label for buses and minibuses
        if ((vehicleType === 'bus' || vehicleType === 'minibus') && driver && driver.routeFrom && driver.routeTo) {
            const routeText = `${driver.routeFrom} → ${driver.routeTo}`;
            iconHtml = `
                <div class="vehicle-with-route">
                    <div class="vehicle-icon-no-bg">${icons[vehicleType]}</div>
                    <div class="route-label">${routeText}</div>
                </div>
            `;
        }
        
        return L.divIcon({
            className: `vehicle-marker vehicle-${vehicleType}`,
            html: iconHtml,
            iconSize: vehicleType === 'bus' || vehicleType === 'minibus' ? [120, 40] : [24, 24],
            iconAnchor: vehicleType === 'bus' || vehicleType === 'minibus' ? [60, 40] : [12, 24]
        });
    }

    createVehiclePopup(driver) {
        return `
            <div class="vehicle-popup">
                <h4>${driver.vehicleType} - ${driver.name}</h4>
                <p><strong>Plate:</strong> ${driver.plate}</p>
                <p><strong>Phone:</strong> <a href="tel:${driver.phone}">${driver.phone}</a></p>
                ${driver.routeFrom ? `<p><strong>Route:</strong> ${driver.routeFrom} → ${driver.routeTo}</p>` : ''}
                ${driver.taxiNumber ? `<p><strong>Taxi #:</strong> ${driver.taxiNumber}</p>` : ''}
            </div>
        `;
    }

    filterVehicles() {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const filtered = drivers.filter(driver => {
            if (!driver.approved || !driver.online || !driver.location) return false;
            if (this.activeFilters.size > 0 && !this.activeFilters.has(driver.vehicleType)) return false;
            return true;
        });
        this.displayVehiclesOnMap(filtered);
    }

    // Restored: Vehicle filtering functionality with icon-only interface

    async locateUser() {
        try {
            const location = await this.getCurrentLocation();
            this.userLocation = location;
            
            if (this.userMarker) this.map.removeLayer(this.userMarker);
            
            this.userMarker = L.marker([location.lat, location.lng], {
                icon: L.divIcon({
                    className: 'user-marker',
                    html: '<i class="fas fa-crosshairs" style="color: #1e88e5; font-size: 20px;"></i>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(this.map);
            
            this.map.setView([location.lat, location.lng], 15);
            this.showMessage('Location found!', 'success');
            
        } catch (error) {
            console.error('Location error:', error);
            if (error.code === 1) { // PERMISSION_DENIED
                this.showMessage('Location permission denied. Please enable location access in your browser settings.', 'warning');
                this.locationPermissionDenied = true;
            } else {
                this.showMessage('Failed to get location', 'danger');
            }
        }
    }

    async updateLocation() {
        if (!this.currentDriver) return;
        
        try {
            const location = await this.getCurrentLocation();
            
            if (!isPointInIraq(location.lat, location.lng)) {
                this.showMessage('Must be in Iraq', 'danger');
                return;
            }
            
            this.currentDriver.location = location;
            await this.updateDriverData(this.currentDriver);
            this.showMessage('Location updated!', 'success');
            
        } catch (error) {
            console.error('Location update error:', error);
            this.locationPermissionDenied = true;
            this.showMessage('Failed to update location', 'danger');
        }
    }

    async updateLocationSilently() {
        if (!this.currentDriver || this.locationPermissionDenied) return;
        
        try {
            const location = await this.getCurrentLocation();
            
            if (!isPointInIraq(location.lat, location.lng)) {
                console.warn('Driver location outside Iraq, stopping auto-updates');
                this.autoLocationUpdate = false;
                return;
            }
            
            this.currentDriver.location = location;
            this.currentDriver.lastSeen = Date.now();
            await this.updateDriverData(this.currentDriver);
            console.log('Location updated silently');
            
        } catch (error) {
            console.warn('Silent location update failed:', error.message);
            this.locationPermissionDenied = true;
            this.autoLocationUpdate = false;
        }
    }

    async handleAdminLogin() {
        const email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-password').value;
        
        if (email === 'euzardi@gmail.com' && password === 'Sarchnar1') {
            this.currentAdmin = { email, role: 'super-admin' };
            this.showAdminDashboard();
        } else {
            this.showMessage('Invalid admin credentials', 'danger', 'admin-login-message');
        }
    }

    showAdminDashboard() {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        this.loadAdminData();
        this.initializeDashboard();
        this.loadAboutContent(); // Load about content when admin logs in
    }

    async loadAdminData() {
        console.log('Loading admin data...');
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        console.log('All drivers from localStorage:', drivers);
        
        const pending = drivers.filter(d => !d.approved);
        console.log('Pending drivers (not approved):', pending);
        
        this.populatePendingDriversTable(pending);
        this.populateAllDriversTable(drivers);
        
        // Load email configuration
        this.loadEmailConfiguration();
        
        // Update dashboard stats if they exist
        if (this.updateDashboardStats) {
            this.updateDashboardStats();
        }
    }
    
    loadEmailConfiguration() {
        const config = JSON.parse(localStorage.getItem('emailConfig') || '{}');
        if (config.serviceId) {
            document.getElementById('emailjs-service-id').value = config.serviceId;
        }
        if (config.templateId) {
            document.getElementById('emailjs-template-id').value = config.templateId;
        }
        if (config.userId) {
            document.getElementById('emailjs-user-id').value = config.userId;
        }
    }
    
    configureEmailService() {
        const serviceId = document.getElementById('emailjs-service-id').value.trim();
        const templateId = document.getElementById('emailjs-template-id').value.trim();
        const userId = document.getElementById('emailjs-user-id').value.trim();
        
        if (!serviceId || !templateId || !userId) {
            this.showMessage('Please fill all email configuration fields', 'danger', 'email-config-message');
            return;
        }
        
        const config = { serviceId, templateId, userId };
        localStorage.setItem('emailConfig', JSON.stringify(config));
        
        // Configure the email service
        this.emailService.configure(config);
        
        this.showMessage('Email configuration saved successfully!', 'success', 'email-config-message');
    }
    
    async testEmailService() {
        try {
            const testDriver = {
                name: 'Test Driver',
                email: 'test@example.com',
                phone: '+964 xxx xxx xxx',
                vehicleType: 'taxi',
                plate: 'TEST-123',
                licenseNumber: 'TEST-LICENSE'
            };
            
            const result = await this.emailService.sendWelcomeEmail(testDriver);
            if (result.success) {
                this.showMessage('Test email sent successfully! Check console for details.', 'success', 'email-config-message');
            } else {
                this.showMessage('Test email failed: ' + result.error, 'danger', 'email-config-message');
            }
        } catch (error) {
            this.showMessage('Test email error: ' + error.message, 'danger', 'email-config-message');
        }
    }

    debugDrivers() {
        console.log('=== DRIVER DEBUG INFO ===');
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        console.log('Total drivers in localStorage:', drivers.length);
        console.log('All drivers:', drivers);
        
        const pending = drivers.filter(d => !d.approved);
        const approved = drivers.filter(d => d.approved);
        
        console.log('Pending drivers:', pending.length, pending);
        console.log('Approved drivers:', approved.length, approved);
        
        // Check if table elements exist
        const pendingTable = document.getElementById('pending-drivers-tbody');
        const allTable = document.getElementById('all-drivers-tbody');
        
        console.log('Pending table element exists:', !!pendingTable);
        console.log('All drivers table element exists:', !!allTable);
        
        if (pendingTable) {
            console.log('Pending table current rows:', pendingTable.children.length);
        }
        if (allTable) {
            console.log('All drivers table current rows:', allTable.children.length);
        }
        
        // Show alert with summary
        alert(`Debug Info:

Total Drivers: ${drivers.length}
Pending: ${pending.length}
Approved: ${approved.length}

Check console for detailed information.`);
    }

    // Content Management Methods
    loadAboutContent() {
        const aboutData = JSON.parse(localStorage.getItem('aboutContent') || '{}');
        
        // Load default content if none exists
        const defaultContent = {
            companyName: 'NEXŞE',
            tagline: "Iraq's Premier Vehicle Tracking Platform",
            description: 'NEXŞE is a cutting-edge real-time vehicle tracking system specifically designed for Iraq. We connect drivers and passengers across the country, providing safe, reliable, and efficient transportation services with advanced GPS tracking and secure payment systems.',
            mission: 'Our mission is to revolutionize transportation in Iraq by providing a secure, efficient, and user-friendly platform that connects drivers and passengers while ensuring safety and reliability for all users.',
            contact: {
                phone: '+964 xxx xxx xxx',
                email: 'info@nexse.iq',
                address: 'Baghdad, Iraq',
                social: {
                    facebook: 'https://facebook.com/nexse',
                    twitter: 'https://twitter.com/nexse',
                    instagram: 'https://instagram.com/nexse'
                }
            },
            lastUpdated: Date.now(),
            status: 'published'
        };
        
        const content = { ...defaultContent, ...aboutData };
        
        // Populate form fields
        document.getElementById('company-name').value = content.companyName || '';
        document.getElementById('company-tagline').value = content.tagline || '';
        document.getElementById('company-description').value = content.description || '';
        document.getElementById('company-mission').value = content.mission || '';
        document.getElementById('contact-phone').value = content.contact?.phone || '';
        document.getElementById('contact-email').value = content.contact?.email || '';
        document.getElementById('contact-address').value = content.contact?.address || '';
        document.getElementById('social-links').value = JSON.stringify(content.contact?.social || {}, null, 2);
        
        // Update stats
        this.updateContentStats(content);
        
        // Load content into About Us page
        this.renderAboutPage(content);
    }
    
    saveAboutContent() {
        try {
            const content = {
                companyName: document.getElementById('company-name').value.trim(),
                tagline: document.getElementById('company-tagline').value.trim(),
                description: document.getElementById('company-description').value.trim(),
                mission: document.getElementById('company-mission').value.trim(),
                contact: {
                    phone: document.getElementById('contact-phone').value.trim(),
                    email: document.getElementById('contact-email').value.trim(),
                    address: document.getElementById('contact-address').value.trim(),
                    social: JSON.parse(document.getElementById('social-links').value || '{}')
                },
                lastUpdated: Date.now(),
                status: 'published'
            };
            
            localStorage.setItem('aboutContent', JSON.stringify(content));
            this.updateContentStats(content);
            this.renderAboutPage(content);
            
            this.showMessage('Content saved successfully!', 'success', 'content-management-message');
        } catch (error) {
            console.error('Error saving content:', error);
            this.showMessage('Error saving content: ' + error.message, 'danger', 'content-management-message');
        }
    }
    
    previewAboutContent() {
        this.showSection('about');
    }
    
    updateContentStats(content) {
        const totalWords = this.countWords(content.description + ' ' + content.mission);
        const lastUpdated = content.lastUpdated ? new Date(content.lastUpdated).toLocaleDateString() : 'Never';
        const status = content.status || 'draft';
        
        document.getElementById('content-words').textContent = totalWords;
        document.getElementById('last-updated').textContent = lastUpdated;
        document.getElementById('content-status').textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
    
    renderAboutPage(content) {
        const mainContent = document.getElementById('about-main-content');
        const contactDetails = document.getElementById('contact-details');
        
        if (mainContent) {
            mainContent.innerHTML = `
                <div style="margin-bottom: 2rem;">
                    <h3>About ${content.companyName}</h3>
                    <p style="line-height: 1.8; color: #333; font-size: 1rem;">${content.description}</p>
                </div>
                
                <div style="margin-bottom: 2rem;">
                    <h3>Our Mission</h3>
                    <p style="line-height: 1.8; color: #333; font-size: 1rem;">${content.mission}</p>
                </div>
            `;
        }
        
        if (contactDetails && content.contact) {
            let socialLinks = '';
            if (content.contact.social) {
                socialLinks = Object.entries(content.contact.social)
                    .map(([platform, url]) => `<a href="${url}" target="_blank" style="color: white; margin: 0 0.5rem;"><i class="fab fa-${platform}"></i> ${platform.charAt(0).toUpperCase() + platform.slice(1)}</a>`)
                    .join('');
            }
            
            contactDetails.innerHTML = `
                <p><i class="fas fa-phone"></i> ${content.contact.phone}</p>
                <p><i class="fas fa-envelope"></i> ${content.contact.email}</p>
                <p><i class="fas fa-map-marker-alt"></i> ${content.contact.address}</p>
                ${socialLinks ? `<div style="margin-top: 1rem;">${socialLinks}</div>` : ''}
            `;
        }
    }

    // Driver Management Functions
    showAddDriverModal() {
        this.clearDriverModal();
        document.getElementById('driver-modal-title').innerHTML = '<i class="fas fa-plus"></i> Add New Driver';
        document.getElementById('driver-modal').style.display = 'flex';
        
        // Setup vehicle type change listener
        document.getElementById('modal-vehicle-type').addEventListener('change', (e) => {
            this.toggleModalVehicleTypeFields(e.target.value);
        });
    }

    editDriver(driverId) {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const driver = drivers.find(d => d.id === driverId);
        
        if (!driver) {
            this.showMessage('Driver not found', 'danger');
            return;
        }
        
        // Populate modal with driver data
        document.getElementById('driver-modal-title').innerHTML = '<i class="fas fa-edit"></i> Edit Driver';
        document.getElementById('modal-driver-id').value = driver.id;
        document.getElementById('modal-driver-name').value = driver.name || '';
        document.getElementById('modal-driver-email').value = driver.email || '';
        document.getElementById('modal-driver-phone').value = driver.phone || '';
        document.getElementById('modal-license-number').value = driver.licenseNumber || '';
        document.getElementById('modal-vehicle-plate').value = driver.plate || '';
        document.getElementById('modal-vehicle-type').value = driver.vehicleType || '';
        document.getElementById('modal-route-from').value = driver.routeFrom || '';
        document.getElementById('modal-route-to').value = driver.routeTo || '';
        document.getElementById('modal-taxi-number').value = driver.taxiNumber || '';
        document.getElementById('modal-driver-password').value = driver.password || '';
        document.getElementById('modal-driver-approved').checked = driver.approved || false;
        document.getElementById('modal-driver-online').checked = driver.online || false;
        
        // Show/hide vehicle-specific fields
        this.toggleModalVehicleTypeFields(driver.vehicleType);
        
        // Setup vehicle type change listener
        document.getElementById('modal-vehicle-type').addEventListener('change', (e) => {
            this.toggleModalVehicleTypeFields(e.target.value);
        });
        
        document.getElementById('driver-modal').style.display = 'flex';
    }

    closeDriverModal() {
        document.getElementById('driver-modal').style.display = 'none';
        this.clearDriverModal();
    }

    clearDriverModal() {
        document.getElementById('modal-driver-id').value = '';
        document.getElementById('modal-driver-name').value = '';
        document.getElementById('modal-driver-email').value = '';
        document.getElementById('modal-driver-phone').value = '';
        document.getElementById('modal-license-number').value = '';
        document.getElementById('modal-vehicle-plate').value = '';
        document.getElementById('modal-vehicle-type').value = '';
        document.getElementById('modal-route-from').value = '';
        document.getElementById('modal-route-to').value = '';
        document.getElementById('modal-taxi-number').value = '';
        document.getElementById('modal-driver-password').value = '';
        document.getElementById('modal-driver-approved').checked = false;
        document.getElementById('modal-driver-online').checked = false;
        document.getElementById('driver-modal-message').innerHTML = '';
        
        // Hide vehicle-specific fields
        document.getElementById('modal-bus-fields').style.display = 'none';
        document.getElementById('modal-taxi-fields').style.display = 'none';
    }

    toggleModalVehicleTypeFields(vehicleType) {
        document.getElementById('modal-bus-fields').style.display = 
            vehicleType === 'bus' ? 'block' : 'none';
        document.getElementById('modal-taxi-fields').style.display = 
            vehicleType === 'taxi' ? 'block' : 'none';
    }

    async saveDriver() {
        try {
            const driverId = document.getElementById('modal-driver-id').value;
            const isEdit = !!driverId;
            
            const driverData = {
                name: document.getElementById('modal-driver-name').value.trim(),
                email: document.getElementById('modal-driver-email').value.trim(),
                phone: document.getElementById('modal-driver-phone').value.trim(),
                licenseNumber: document.getElementById('modal-license-number').value.trim(),
                plate: document.getElementById('modal-vehicle-plate').value.trim(),
                vehicleType: document.getElementById('modal-vehicle-type').value,
                routeFrom: document.getElementById('modal-route-from').value.trim(),
                routeTo: document.getElementById('modal-route-to').value.trim(),
                taxiNumber: document.getElementById('modal-taxi-number').value.trim(),
                password: document.getElementById('modal-driver-password').value,
                approved: document.getElementById('modal-driver-approved').checked,
                online: document.getElementById('modal-driver-online').checked,
                lastSeen: Date.now()
            };
            
            // Validation
            if (!driverData.name || !driverData.email || !driverData.phone || 
                !driverData.licenseNumber || !driverData.plate || !driverData.vehicleType || 
                !driverData.password) {
                this.showMessage('Please fill all required fields', 'danger', 'driver-modal-message');
                return;
            }
            
            if (driverData.vehicleType === 'bus' && (!driverData.routeFrom || !driverData.routeTo)) {
                this.showMessage('Bus drivers must specify routes', 'danger', 'driver-modal-message');
                return;
            }
            
            const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
            
            if (isEdit) {
                // Update existing driver
                const index = drivers.findIndex(d => d.id === driverId);
                if (index !== -1) {
                    drivers[index] = { ...drivers[index], ...driverData };
                    localStorage.setItem('drivers', JSON.stringify(drivers));
                    this.showMessage('Driver updated successfully!', 'success', 'driver-modal-message');
                }
            } else {
                // Add new driver
                driverData.id = Date.now().toString();
                driverData.registeredAt = Date.now();
                
                // Set default location (Baghdad center) for new drivers
                driverData.location = {
                    lat: 33.3152,
                    lng: 44.3661,
                    timestamp: Date.now()
                };
                driverData.country = 'IQ';
                
                drivers.push(driverData);
                localStorage.setItem('drivers', JSON.stringify(drivers));
                
                // Send welcome email if approved
                if (driverData.approved) {
                    try {
                        await this.emailService.sendWelcomeEmail(driverData);
                        this.dashboardStats.emailsSent++;
                    } catch (error) {
                        console.error('Error sending welcome email:', error);
                    }
                }
                
                this.showMessage('Driver added successfully!', 'success', 'driver-modal-message');
            }
            
            // Refresh admin data
            setTimeout(() => {
                this.loadAdminData();
                this.closeDriverModal();
            }, 1500);
            
        } catch (error) {
            console.error('Error saving driver:', error);
            this.showMessage('Error saving driver: ' + error.message, 'danger', 'driver-modal-message');
        }
    }

    async toggleDriverOnlineStatus(driverId) {
        try {
            const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
            const index = drivers.findIndex(d => d.id === driverId);
            
            if (index === -1) {
                this.showMessage('Driver not found', 'danger');
                return;
            }
            
            const driver = drivers[index];
            const newStatus = !driver.online;
            
            // Update driver status
            drivers[index].online = newStatus;
            drivers[index].lastSeen = Date.now();
            
            localStorage.setItem('drivers', JSON.stringify(drivers));
            
            // Refresh the vehicles on map
            this.loadVehicles();
            this.loadAdminData();
            
            this.showMessage(
                `Driver ${driver.name} is now ${newStatus ? 'online' : 'offline'}`, 
                'success'
            );
            
        } catch (error) {
            console.error('Error toggling driver status:', error);
            this.showMessage('Error updating driver status', 'danger');
        }
    }

    populatePendingDriversTable(drivers) {
        const tbody = document.getElementById('pending-drivers-tbody');
        if (!tbody) {
            console.error('Pending drivers table body not found!');
            return;
        }
        
        console.log('Populating pending drivers table with:', drivers);
        tbody.innerHTML = '';
        
        if (drivers.length === 0) {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td colspan="8" style="text-align: center; color: #666; padding: 2rem;">
                    <i class="fas fa-info-circle"></i> No pending driver approvals
                </td>
            `;
            return;
        }
        
        drivers.forEach(driver => {
            console.log('Adding pending driver:', driver.name, 'Approved:', driver.approved);
            const row = tbody.insertRow();
            const registrationDate = driver.registeredAt ? new Date(driver.registeredAt).toLocaleDateString() : 'Unknown';
            const vehicleIcon = this.getVehicleIcon(driver.vehicleType).options.html;
            
            row.innerHTML = `
                <td>${driver.name || 'N/A'}</td>
                <td>
                    <a href="mailto:${driver.email || ''}" style="color: var(--primary-color); text-decoration: none;">
                        <i class="fas fa-envelope"></i> ${driver.email || 'N/A'}
                    </a>
                </td>
                <td>
                    <a href="tel:${driver.phone || ''}" style="color: var(--primary-color); text-decoration: none;">
                        <i class="fas fa-phone"></i> ${driver.phone || 'N/A'}
                    </a>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${vehicleIcon}
                        <span>${driver.vehicleType || 'N/A'}</span>
                    </div>
                </td>
                <td><strong>${driver.plate || 'N/A'}</strong></td>
                <td>
                    <small>
                        <strong>License:</strong> ${driver.licenseNumber || 'N/A'}<br>
                        ${driver.routeFrom ? `<strong>Route:</strong> ${driver.routeFrom} → ${driver.routeTo}<br>` : ''}
                        ${driver.taxiNumber ? `<strong>Taxi #:</strong> ${driver.taxiNumber}<br>` : ''}
                        <strong>Registered:</strong> ${registrationDate}
                    </small>
                </td>
                <td><span class="badge badge-warning"><i class="fas fa-clock"></i> Pending</span></td>
                <td>
                    <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                        <button class="btn btn-sm" style="background: var(--success-color); color: white; padding: 0.25rem 0.5rem;" 
                                onclick="app.approveDriver('${driver.id}')" title="Approve Driver">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm" style="background: var(--danger-color); color: white; padding: 0.25rem 0.5rem;" 
                                onclick="app.rejectDriver('${driver.id}')" title="Reject Driver">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="btn btn-sm" style="background: var(--warning-color); color: white; padding: 0.25rem 0.5rem;" 
                                onclick="app.editDriver('${driver.id}')" title="Edit Driver Details">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm" style="background: var(--primary-color); color: white; padding: 0.25rem 0.5rem;" 
                                onclick="app.contactDriver('${driver.id}')" title="Contact Driver">
                            <i class="fas fa-comment"></i>
                        </button>
                    </div>
                </td>
            `;
        });
    }

    populateAllDriversTable(drivers) {
        const tbody = document.getElementById('all-drivers-tbody');
        if (!tbody) {
            console.error('All drivers table body not found!');
            return;
        }
        
        console.log('Populating all drivers table with:', drivers);
        tbody.innerHTML = '';
        
        if (drivers.length === 0) {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td colspan="9" style="text-align: center; color: #666; padding: 2rem;">
                    <i class="fas fa-info-circle"></i> No drivers registered
                </td>
            `;
            return;
        }
        
        drivers.forEach(driver => {
            const row = tbody.insertRow();
            const status = driver.approved ? 'Approved' : 'Pending';
            const online = driver.online ? 'Online' : 'Offline';
            const onlineClass = driver.online ? 'success' : 'secondary';
            const statusClass = driver.approved ? 'success' : 'warning';
            const lastSeen = driver.lastSeen ? new Date(driver.lastSeen).toLocaleString() : 'Never';
            const registrationDate = driver.registeredAt ? new Date(driver.registeredAt).toLocaleDateString() : 'Unknown';
            const vehicleIcon = this.getVehicleIcon(driver.vehicleType).options.html;
            
            row.innerHTML = `
                <td>${driver.name || 'N/A'}</td>
                <td>
                    <a href="mailto:${driver.email || ''}" style="color: var(--primary-color); text-decoration: none;">
                        <i class="fas fa-envelope"></i> ${driver.email || 'N/A'}
                    </a>
                </td>
                <td>
                    <a href="tel:${driver.phone || ''}" style="color: var(--primary-color); text-decoration: none;">
                        <i class="fas fa-phone"></i> ${driver.phone || 'N/A'}
                    </a>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${vehicleIcon}
                        <span>${driver.vehicleType || 'N/A'}</span>
                    </div>
                </td>
                <td><strong>${driver.plate || 'N/A'}</strong></td>
                <td>
                    <small>
                        <strong>License:</strong> ${driver.licenseNumber || 'N/A'}<br>
                        ${driver.routeFrom ? `<strong>Route:</strong> ${driver.routeFrom} → ${driver.routeTo}<br>` : ''}
                        ${driver.taxiNumber ? `<strong>Taxi #:</strong> ${driver.taxiNumber}<br>` : ''}
                        <strong>Registered:</strong> ${registrationDate}<br>
                        <strong>Last Seen:</strong> ${lastSeen}
                    </small>
                </td>
                <td>
                    <span class="badge badge-${statusClass}"><i class="fas fa-${driver.approved ? 'check-circle' : 'clock'}"></i> ${status}</span><br>
                    <span class="badge badge-${onlineClass}"><i class="fas fa-circle"></i> ${online}</span>
                    ${driver.approved ? `<br>
                        <button class="btn btn-sm btn-${driver.online ? 'warning' : 'success'}" 
                                onclick="app.toggleDriverOnlineStatus('${driver.id}')" 
                                title="${driver.online ? 'Force Offline' : 'Force Online'}" style="margin-top: 0.25rem;">
                            <i class="fas fa-${driver.online ? 'pause' : 'play'}"></i>
                        </button>
                    ` : ''}
                </td>
                <td>
                    ${driver.location ? 
                        `<small>${driver.location.lat.toFixed(4)}, ${driver.location.lng.toFixed(4)}</small>` : 
                        '<small style="color: #999;">No location</small>'}
                </td>
                <td>
                    <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-primary" onclick="app.viewDriverOnMap('${driver.id}')" title="View on Map">
                            <i class="fas fa-map-marker-alt"></i>
                        </button>
                        <button class="btn btn-sm" style="background: var(--warning-color); color: white;" onclick="app.editDriver('${driver.id}')" title="Edit Driver Details">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm" style="background: var(--secondary-color); color: white;" onclick="app.contactDriver('${driver.id}')" title="Contact Driver">
                            <i class="fas fa-comment"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.removeDriver('${driver.id}')" title="Delete Driver">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
        });
    }

    async approveDriver(driverId) {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const index = drivers.findIndex(d => d.id === driverId);
        if (index !== -1) {
            drivers[index].approved = true;
            localStorage.setItem('drivers', JSON.stringify(drivers));
            
            // Send approval email to the driver
            try {
                const emailResult = await this.emailService.sendApprovalEmail(drivers[index]);
                if (emailResult.success) {
                    console.log('Approval email sent successfully');
                    this.showMessage('Driver approved! Approval email sent.', 'success');
                    this.dashboardStats.emailsSent++;
                } else {
                    console.error('Failed to send approval email:', emailResult.error);
                    this.showMessage('Driver approved, but email notification failed.', 'warning');
                }
            } catch (error) {
                console.error('Error sending approval email:', error);
                this.showMessage('Driver approved, but email notification failed.', 'warning');
            }
            
            this.loadAdminData();
        }
    }

    async rejectDriver(driverId) {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const filtered = drivers.filter(d => d.id !== driverId);
        localStorage.setItem('drivers', JSON.stringify(filtered));
        this.loadAdminData();
        this.showMessage('Driver rejected', 'success');
    }

    async removeDriver(driverId) {
        if (confirm('Remove this driver?')) {
            const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
            const filtered = drivers.filter(d => d.id !== driverId);
            localStorage.setItem('drivers', JSON.stringify(filtered));
            this.loadAdminData();
            this.loadVehicles();
        }
    }

    // Contact driver function
    contactDriver(driverId) {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const driver = drivers.find(d => d.id === driverId);
        
        if (!driver) {
            this.showMessage('Driver not found', 'danger');
            return;
        }
        
        const contactOptions = [
            driver.email ? `📧 Email: ${driver.email}` : null,
            driver.phone ? `📞 Phone: ${driver.phone}` : null,
            '✏️ Edit Driver Information',
            '💬 Send message through NEXŞE system'
        ].filter(Boolean);
        
        const message = `Contact ${driver.name}:\n\n${contactOptions.join('\n')}\n\nChoose an option:`;
        
        const choice = prompt(`${message}\n\n1. Send Email\n2. Call/Copy Phone\n3. Edit Driver\n4. Cancel\n\nEnter choice (1-4):`);
        
        switch(choice) {
            case '1':
                if (driver.email) {
                    const emailSubject = `NEXŞE Admin Contact - ${driver.name}`;
                    const emailBody = `Dear ${driver.name},\n\nThis is a message from NEXŞE administration.\n\n[Your message here]\n\nBest regards,\nNEXŞE Admin Team`;
                    const emailUrl = `mailto:${driver.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                    window.open(emailUrl, '_blank');
                } else {
                    alert('No email available for this driver');
                }
                break;
                
            case '2':
                if (driver.phone) {
                    if (confirm(`Call ${driver.phone}?\n\nClick OK to call, Cancel to copy number`)) {
                        window.open(`tel:${driver.phone}`, '_blank');
                    } else {
                        navigator.clipboard.writeText(driver.phone).then(() => {
                            this.showMessage(`Phone number ${driver.phone} copied to clipboard`, 'success');
                        }).catch(() => {
                            prompt('Copy this phone number:', driver.phone);
                        });
                    }
                } else {
                    alert('No phone number available for this driver');
                }
                break;
                
            case '3':
                this.editDriver(driverId);
                break;
                
            default:
                // Cancel or invalid choice
                break;
        }
    }

    viewDriverOnMap(driverId) {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const driver = drivers.find(d => d.id === driverId);
        
        if (driver && driver.location) {
            this.showSection('map');
            this.map.setView([driver.location.lat, driver.location.lng], 15);
        }
    }

    logoutDriver() {
        this.currentDriver = null;
        document.getElementById('driver-login').style.display = 'block';
        document.getElementById('driver-dashboard').style.display = 'none';
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }
    }

    logoutAdmin() {
        this.currentAdmin = null;
        document.getElementById('admin-login').style.display = 'block';
        document.getElementById('admin-dashboard').style.display = 'none';
    }

    showMessage(message, type, containerId = null) {
        const alertClass = `alert alert-${type}`;
        const alertHtml = `<div class="${alertClass}">${message}</div>`;
        
        if (containerId) {
            document.getElementById(containerId).innerHTML = alertHtml;
        } else {
            // Show global message
            console.log(`${type.toUpperCase()}: ${message}`);
        }
        
        // Auto-hide after 5 seconds
        if (containerId) {
            setTimeout(() => {
                const container = document.getElementById(containerId);
                if (container) container.innerHTML = '';
            }, 5000);
        }
    }

    toggleVehicleTypeFields(vehicleType) {
        document.getElementById('bus-fields').style.display = 
            vehicleType === 'bus' ? 'block' : 'none';
        document.getElementById('taxi-fields').style.display = 
            vehicleType === 'taxi' ? 'block' : 'none';
    }

    setupRealtimeListeners() {
        // Refresh vehicles every 10 seconds
        setInterval(() => this.loadVehicles(), 10000);
        
        // Update driver location every 2 minutes if online and auto-update enabled
        setInterval(() => {
            if (this.currentDriver && this.currentDriver.online && this.autoLocationUpdate) {
                this.updateLocationSilently();
            }
        }, 120000); // Changed to 2 minutes
        
        // Update dashboard every 30 seconds if admin is logged in
        setInterval(() => {
            if (this.currentAdmin) {
                this.updateDashboardStats();
            }
        }, 30000);
    }

    // Dashboard Methods
    initializeDashboard() {
        this.updateDashboardStats();
        this.createDashboardCharts();
        this.loadRecentActivity();
        // Show overview tab by default
        this.showDashboardTab('overview');
    }

    updateDashboardStats() {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        
        // Update statistics
        this.dashboardStats.totalDrivers = drivers.length;
        this.dashboardStats.onlineDrivers = drivers.filter(d => d.online && d.approved).length;
        this.dashboardStats.pendingApprovals = drivers.filter(d => !d.approved).length;
        
        // Update DOM elements
        document.getElementById('total-drivers').textContent = this.dashboardStats.totalDrivers;
        document.getElementById('online-drivers').textContent = this.dashboardStats.onlineDrivers;
        document.getElementById('pending-approvals').textContent = this.dashboardStats.pendingApprovals;
        
        // Update trends
        const lastWeekDrivers = drivers.filter(d => {
            const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            return d.registeredAt > weekAgo;
        }).length;
        document.getElementById('drivers-trend').textContent = `+${lastWeekDrivers} this week`;
        
        // Update analytics stats
        document.getElementById('emails-sent').textContent = this.dashboardStats.emailsSent;
    }

    createDashboardCharts() {
        this.createVehicleDistributionChart();
        this.createRegistrationTimelineChart();
        this.createActivityChart();
    }

    createVehicleDistributionChart() {
        const ctx = document.getElementById('vehicle-chart');
        if (!ctx) return;
        
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const vehicleTypes = {};
        
        drivers.forEach(driver => {
            vehicleTypes[driver.vehicleType] = (vehicleTypes[driver.vehicleType] || 0) + 1;
        });
        
        const data = {
            labels: Object.keys(vehicleTypes),
            datasets: [{
                data: Object.values(vehicleTypes),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                ],
                borderWidth: 0
            }]
        };
        
        if (this.dashboardCharts.vehicleChart) {
            this.dashboardCharts.vehicleChart.destroy();
        }
        
        this.dashboardCharts.vehicleChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createRegistrationTimelineChart() {
        const ctx = document.getElementById('registration-chart');
        if (!ctx) return;
        
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const last7Days = [];
        const registrations = [];
        
        // Generate last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            
            const dayRegistrations = drivers.filter(d => {
                const regDate = new Date(d.registeredAt);
                return regDate >= dayStart && regDate <= dayEnd;
            }).length;
            
            registrations.push(dayRegistrations);
        }
        
        if (this.dashboardCharts.registrationChart) {
            this.dashboardCharts.registrationChart.destroy();
        }
        
        this.dashboardCharts.registrationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'New Registrations',
                    data: registrations,
                    borderColor: '#1e88e5',
                    backgroundColor: 'rgba(30, 136, 229, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    createActivityChart() {
        const ctx = document.getElementById('activity-chart');
        if (!ctx) return;
        
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const last7Days = [];
        const activeDrivers = [];
        
        // Generate last 7 days data
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Simulate active drivers data (in real app, this would come from actual activity logs)
            const baseActive = Math.floor(Math.random() * 20) + 10;
            activeDrivers.push(baseActive);
        }
        
        if (this.dashboardCharts.activityChart) {
            this.dashboardCharts.activityChart.destroy();
        }
        
        this.dashboardCharts.activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Active Drivers',
                    data: activeDrivers,
                    backgroundColor: 'rgba(67, 160, 71, 0.8)',
                    borderColor: '#43a047',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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

    loadRecentActivity() {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const activityList = document.getElementById('recent-activity-list');
        
        if (!activityList) return;
        
        // Sort drivers by registration time (most recent first)
        const recentDrivers = drivers
            .sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0))
            .slice(0, 5);
        
        activityList.innerHTML = '';
        
        if (recentDrivers.length === 0) {
            activityList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No recent activity</div>';
            return;
        }
        
        recentDrivers.forEach(driver => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            const timeAgo = this.getTimeAgo(driver.registeredAt);
            const statusColor = driver.approved ? '#43a047' : '#fb8c00';
            const statusIcon = driver.approved ? 'check-circle' : 'clock';
            const statusText = driver.approved ? 'Approved' : 'Pending';
            
            activityItem.innerHTML = `
                <div class="activity-icon" style="background: ${statusColor};">
                    <i class="fas fa-${statusIcon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${driver.name} registered as ${driver.vehicleType}</div>
                    <div class="activity-time">${timeAgo} • ${statusText}</div>
                </div>
            `;
            
            activityList.appendChild(activityItem);
        });
    }

    getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown time';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    showDashboardTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[onclick="showDashboardTab('${tabName}')"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.dashboard-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`dashboard-${tabName}`).classList.add('active');
        
        // Refresh data when switching to specific tabs
        if (tabName === 'drivers') {
            console.log('Refreshing drivers tab data...');
            this.loadAdminData();
        }
        
        // Refresh charts when analytics tab is shown
        if (tabName === 'analytics') {
            setTimeout(() => this.createActivityChart(), 100);
        }
    }
}

// Global functions for onclick handlers
function showSection(section) {
    app.showSection(section);
}

function locateUser() {
    app.locateUser();
}

function updateLocation() {
    app.updateLocation();
}

function logoutDriver() {
    app.logoutDriver();
}

function logoutAdmin() {
    app.logoutAdmin();
}

function showDashboardTab(tabName) {
    app.showDashboardTab(tabName);
}

// Initialize NEXŞE when page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new IraqVehicleTracker();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IraqVehicleTracker;
}