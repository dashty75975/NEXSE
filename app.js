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
        this.activeFilters = new Set(); // Will be populated by loadVehicleTypes
        this.iraqCenter = [33.3152, 44.3661];
        this.autoLocationUpdate = false; // New: Auto location update preference
        this.locationPermissionDenied = false; // Track permission status
        this.locationWatchId = null; // Track real-time location updates
        
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
            console.log('🚀 Initializing NEXŞE...');
            this.initMap();
            this.setupEventListeners();
            this.loadVehicleTypes(); // Load vehicle filter icons
            this.loadVehicles();
            this.setupRealtimeListeners();
            this.loadAboutContent(); // Load about content on page load
            
            // Initialize movement simulation (enabled by default)
            this.movementSimulationEnabled = true;
            console.log('✅ Movement simulation initialized and ENABLED');
            
            // Add some demo drivers if none exist (for testing)
            this.ensureDemoDriversExist();
            
            console.log('✅ NEXŞE initialized successfully');
            console.log('📊 Real-time tracking: Movement simulation enabled');
            console.log('🔄 Vehicle updates: Every 10 seconds');
            console.log('🚗 Movement simulation: Every 15 seconds');
        } catch (error) {
            console.error('❌ Error initializing:', error);
            this.showMessage('Error initializing NEXŞE', 'danger');
        }
    }

    initMap() {
        try {
            console.log('Initializing map...');
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
            if (typeof IRAQ_BOUNDARY !== 'undefined') {
                const iraqLayer = L.geoJSON(IRAQ_BOUNDARY, {
                    style: { color: '#e53935', weight: 2, opacity: 0.6, fillOpacity: 0.1 }
                }).addTo(this.map);
                this.map.fitBounds(iraqLayer.getBounds());
            } else {
                console.warn('Iraq boundary data not loaded');
            }
            
            console.log('Map initialized successfully');
        } catch (error) {
            console.error('Error initializing map:', error);
            throw error;
        }
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

        // Online toggle (if exists - for compatibility)
        const onlineToggle = document.getElementById('online-toggle');
        if (onlineToggle) {
            onlineToggle.addEventListener('change', (e) => {
                this.toggleDriverOnlineStatus(e.target.checked);
            });
        }
    }

    showSection(sectionName) {
        console.log('Switching to section:', sectionName);
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${sectionName}-section`).classList.add('active');
        
        if (sectionName === 'map' && this.map) {
            // Give the map container time to be visible before invalidating size
            setTimeout(() => {
                try {
                    this.map.invalidateSize();
                    console.log('Map size invalidated');
                } catch (error) {
                    console.error('Error invalidating map size:', error);
                }
            }, 200);
        }
    }

    async loadVehicleTypes() {
        const vehicleTypes = this.getVehicleTypes(); // Get from localStorage instead of hardcoded
        this.createVehicleFilters(vehicleTypes);
    }

    createVehicleFilters(vehicleTypes) {
        const container = document.getElementById('header-vehicle-filters');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Add "All" button with text
        const allBtn = this.createHeaderFilterButton('all', 'ALL', 'All Vehicles', true);
        allBtn.classList.add('all-btn');
        container.appendChild(allBtn);
        
        // Add vehicle type buttons (icons only) - only for enabled types
        vehicleTypes.filter(type => type.enabled).forEach(type => {
            const btn = this.createHeaderFilterButton(type.id, type.icon, type.name, true);
            container.appendChild(btn);
        });
        
        // Update active filters to only include enabled vehicle types
        const enabledIds = vehicleTypes.filter(type => type.enabled).map(type => type.id);
        this.activeFilters = new Set(enabledIds);
    }

    createHeaderFilterButton(type, icon, name, active = false) {
        const button = document.createElement('button');
        button.className = `header-filter-btn ${active ? 'active' : ''}`;
        button.innerHTML = icon; // Icon or text content
        button.title = name; // Tooltip shows the name
        button.onclick = () => this.toggleVehicleFilter(type, button);
        return button;
    }

    toggleVehicleFilter(type, button) {
        if (type === 'all') {
            const allActive = button.classList.contains('active');
            document.querySelectorAll('.header-filter-btn').forEach(btn => {
                btn.classList.toggle('active', !allActive);
            });
            if (allActive) {
                this.activeFilters.clear();
            } else {
                // Get enabled vehicle types dynamically
                const enabledTypes = this.getVehicleTypes().filter(t => t.enabled).map(t => t.id);
                this.activeFilters = new Set(enabledTypes);
            }
        } else {
            button.classList.toggle('active');
            if (button.classList.contains('active')) {
                this.activeFilters.add(type);
            } else {
                this.activeFilters.delete(type);
            }
            
            // Update "All" button state
            const allBtn = document.querySelector('.header-filter-btn.all-btn');
            if (allBtn) {
                // Get current enabled types count dynamically
                const enabledTypesCount = this.getVehicleTypes().filter(t => t.enabled).length;
                allBtn.classList.toggle('active', this.activeFilters.size === enabledTypesCount);
            }
        }
        
        this.applyVehicleFilters();
    }

    applyVehicleFilters() {
        console.log('Applying vehicle filters:', Array.from(this.activeFilters));
        this.loadVehicles(); // Reload vehicles with current filters
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
            formData.approved = true; // Auto-approve new drivers
            formData.online = false;
            formData.registeredAt = Date.now();
            
            await this.registerDriver(formData);
            this.showMessage('Registration successful! You can now login and start working.', 'success', 'registration-message');
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
        
        // Ensure the driver has a proper timestamp for location updates
        if (driverData.location) {
            driverData.location.timestamp = Date.now();
        }
        
        // Set initial status for new drivers
        driverData.lastSeen = Date.now();
        driverData.online = false; // Start offline by default
        
        // Auto-approve all drivers EXCEPT taxis (taxis need admin approval)
        if (driverData.vehicleType === 'taxi') {
            driverData.approved = false; // Taxis need admin approval
            console.log('Taxi driver registered - requires admin approval:', driverData.name);
        } else {
            driverData.approved = true; // All other vehicle types are auto-approved
            console.log('Non-taxi driver auto-approved:', driverData.name, 'Vehicle type:', driverData.vehicleType);
        }
        
        console.log('Registering new driver:', driverData.name, 'at location:', driverData.location);
        
        drivers.push(driverData);
        localStorage.setItem('drivers', JSON.stringify(drivers));
        
        console.log('Total drivers after registration:', drivers.length);
        
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
        
        console.log('New driver registered:', driverData.name, 'Location:', driverData.location);
        
        // Show appropriate success message based on vehicle type
        if (driverData.vehicleType === 'taxi') {
            this.showMessage('Registration successful! Your taxi registration is pending admin approval. You will be notified once approved.', 'warning');
        } else {
            this.showMessage('Registration successful! You can now log in and go online to start receiving requests.', 'success');
        }
        
        // Refresh the map immediately to show the new driver if they go online
        this.loadVehicles();
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
                // Check if driver is approved (taxis need approval, others are auto-approved)
                if (!driver.approved) {
                    if (driver.vehicleType === 'taxi') {
                        this.showMessage('Your taxi registration is pending admin approval. Please wait for approval.', 'warning', 'login-message');
                    } else {
                        this.showMessage('Your account is pending approval. Please contact admin.', 'warning', 'login-message');
                    }
                    return;
                }
                
                this.currentDriver = driver;
                this.showDriverDashboard();
                this.showMessage(`Welcome back, ${driver.name}! Use the big button to go online.`, 'success');
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
        
        // Ensure big button is properly initialized
        const bigBtn = document.getElementById('big-online-btn');
        if (bigBtn) {
            bigBtn.disabled = false;
            console.log('Big button initialized and enabled');
        }
        
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
                <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid var(--primary-color);">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--primary-color);">📍 Real-time Location Tracking</h4>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">When you go online, automatic location tracking starts and continuously updates your position on the map for passengers to find you.</p>
                </div>
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
        const bigBtn = document.getElementById('big-online-btn');
        
        console.log('Updating driver status UI:', {
            driver: this.currentDriver?.name,
            online: this.currentDriver?.online,
            hasLocation: !!this.currentDriver?.location
        });
        
        if (this.currentDriver.online) {
            statusEl.className = 'status-indicator status-online';
            statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Online</span>';
            if (toggle) toggle.checked = true;
            
            // Update big button for online state
            if (bigBtn) {
                bigBtn.className = 'big-status-btn online';
                bigBtn.disabled = false;
                bigBtn.innerHTML = `
                    <div class="btn-icon">
                        <i class="fas fa-pause"></i>
                    </div>
                    <div class="btn-content">
                        <div class="btn-title">Go Offline</div>
                        <div class="btn-subtitle">Stop receiving ride requests</div>
                    </div>
                `;
            }
        } else {
            statusEl.className = 'status-indicator status-offline';
            statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Offline</span>';
            if (toggle) toggle.checked = false;
            
            // Update big button for offline state
            if (bigBtn) {
                bigBtn.className = 'big-status-btn offline';
                bigBtn.disabled = false;
                bigBtn.innerHTML = `
                    <div class="btn-icon">
                        <i class="fas fa-power-off"></i>
                    </div>
                    <div class="btn-content">
                        <div class="btn-title">Go Online</div>
                        <div class="btn-subtitle">Start receiving ride requests</div>
                    </div>
                `;
            }
        }
        
        // Add debug info for troubleshooting
        console.log('Driver status UI updated:', {
            driverName: this.currentDriver?.name,
            online: this.currentDriver?.online,
            hasLocation: !!this.currentDriver?.location,
            location: this.currentDriver?.location,
            buttonEnabled: bigBtn ? !bigBtn.disabled : 'N/A'
        });
    }

    async toggleDriverOnlineStatus(online) {
        try {
            console.log('toggleDriverOnlineStatus called with:', online, typeof online);
            
            // Check if driver is approved before allowing online status
            if (!this.currentDriver.approved) {
                if (this.currentDriver.vehicleType === 'taxi') {
                    this.showMessage('Your taxi registration is pending admin approval. You cannot go online until approved.', 'warning');
                } else {
                    this.showMessage('Your account is pending approval. Please contact admin.', 'warning');
                }
                
                // Re-enable big button
                const bigBtn = document.getElementById('big-online-btn');
                if (bigBtn) {
                    bigBtn.disabled = false;
                    bigBtn.style.opacity = '1';
                }
                return;
            }
            
            if (online) {
                const location = await this.getCurrentLocation();
                if (!isPointInIraq(location.lat, location.lng)) {
                    this.showMessage('Must be in Iraq to go online', 'danger');
                    const toggle = document.getElementById('online-toggle');
                    if (toggle) toggle.checked = false;
                    
                    // Re-enable big button
                    const bigBtn = document.getElementById('big-online-btn');
                    if (bigBtn) {
                        bigBtn.disabled = false;
                        bigBtn.style.opacity = '1';
                    }
                    return;
                }
                this.currentDriver.location = location;
                // Start real-time location updates
                this.startRealtimeLocationUpdates();
            } else {
                // Stop real-time location updates
                this.stopRealtimeLocationUpdates();
            }
            
            this.currentDriver.online = online;
            this.currentDriver.lastSeen = Date.now();
            await this.updateDriverData(this.currentDriver);
            this.updateDriverStatus();
            
            // Refresh the map to show/hide this driver
            this.loadVehicles();
            
            const statusMsg = online ? 'You are now online and visible to passengers!' : 'You are now offline and hidden from passengers.';
            this.showMessage(statusMsg, 'success');
            
            // Re-enable big button after successful operation
            const bigBtn = document.getElementById('big-online-btn');
            if (bigBtn) {
                bigBtn.disabled = false;
                bigBtn.style.opacity = '1';
            }
            
        } catch (error) {
            console.error('Error in toggleDriverOnlineStatus:', error);
            this.showMessage('Failed to update status', 'danger');
            const toggle = document.getElementById('online-toggle');
            if (toggle) toggle.checked = !online;
            
            // Re-enable big button on error
            const bigBtn = document.getElementById('big-online-btn');
            if (bigBtn) {
                bigBtn.disabled = false;
                bigBtn.style.opacity = '1';
            }
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
        console.log('All drivers in database:', drivers.length);
        
        // Show only APPROVED drivers (taxis need approval, others are auto-approved)
        const approvedDrivers = drivers.filter(d => d.approved);
        const onlineDrivers = approvedDrivers.filter(d => d.online && d.location);
        
        console.log(`Loading vehicles: ${drivers.length} total drivers, ${approvedDrivers.length} approved, ${onlineDrivers.length} online with location`);
        
        this.displayVehiclesOnMap(approvedDrivers); // Show only approved drivers
        
        // Log current vehicle positions for debugging
        if (onlineDrivers.length > 0) {
            console.log('Current online vehicle positions:');
            onlineDrivers.forEach(driver => {
                console.log(`- ${driver.name} (${driver.vehicleType}): ${driver.location.lat.toFixed(4)}, ${driver.location.lng.toFixed(4)}`);
            });
        } else {
            console.log('No online approved drivers found');
        }
    }

    displayVehiclesOnMap(drivers) {
        this.markerCluster.clearLayers();
        this.vehicleMarkers.clear();
        
        drivers.forEach(driver => {
            if (driver.location && driver.online) {
                // Apply vehicle type filter
                if (this.activeFilters.size === 0 || this.activeFilters.has(driver.vehicleType)) {
                    this.addVehicleMarker(driver);
                }
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
        
        // Only taxi drivers need approval, others are auto-approved
        const pending = drivers.filter(d => !d.approved && d.vehicleType === 'taxi');
        console.log('Pending taxi drivers (not approved):', pending);
        
        this.populatePendingDriversTable(pending);
        this.populateAllDriversTable(drivers);
        
        // Load email configuration
        this.loadEmailConfiguration();
        
        // Update dashboard stats if they exist
        if (this.updateDashboardStats) {
            this.updateDashboardStats();
        }
        
        // Update movement status info
        this.updateMovementStatusInfo();
        
        // Load vehicle types for management
        this.loadVehicleTypesForManagement();
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
        const online = drivers.filter(d => d.approved && d.online);
        const withLocation = drivers.filter(d => d.location);
        
        console.log('Pending drivers:', pending.length, pending);
        console.log('Approved drivers:', approved.length, approved);
        console.log('Online drivers:', online.length, online);
        console.log('Drivers with location:', withLocation.length, withLocation);
        
        // Check movement simulation status
        console.log('Movement simulation active for online drivers');
        online.forEach(driver => {
            console.log(`- ${driver.name} (${driver.vehicleType}): ${driver.location ? 'Has location' : 'No location'}`);
        });
        
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
Online: ${online.length}
With Location: ${withLocation.length}

Movement simulation is ${online.length > 0 ? 'ACTIVE' : 'INACTIVE'}

Check console for detailed information.`);
    }
    
    // Add function to force movement update for testing
    forceMovementUpdate() {
        console.log('🚀 Forcing movement update for all online drivers...');
        
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const eligibleDrivers = drivers.filter(d => d.approved && d.online && d.location);
        
        if (eligibleDrivers.length === 0) {
            const message = 'No online approved drivers available for movement simulation';
            console.warn('⚠️ ' + message);
            this.showMessage(message, 'warning');
            return;
        }
        
        console.log(`🏁 Found ${eligibleDrivers.length} eligible drivers for movement`);
        this.simulateVehicleMovement();
        this.showMessage(`Movement triggered for ${eligibleDrivers.length} vehicles! Check the map.`, 'success');
    }
    
    // Add function to enable/disable movement simulation
    toggleMovementSimulation() {
        if (this.movementSimulationEnabled === undefined) {
            this.movementSimulationEnabled = true;
        }
        
        this.movementSimulationEnabled = !this.movementSimulationEnabled;
        
        const status = this.movementSimulationEnabled ? 'ENABLED' : 'DISABLED';
        const message = this.movementSimulationEnabled ? 
            '✅ Movement simulation ENABLED - Vehicles will move automatically every 15 seconds' : 
            '⛔ Movement simulation DISABLED - Vehicles will only move when real drivers update location';
        
        // Update button text
        const toggleBtn = document.querySelector('[onclick="app.toggleMovementSimulation()"]');
        if (toggleBtn) {
            const icon = this.movementSimulationEnabled ? 'pause' : 'play';
            const text = this.movementSimulationEnabled ? 'Stop Simulation' : 'Start Simulation';
            toggleBtn.innerHTML = `<i class="fas fa-${icon}"></i> ${text}`;
        }
        
        this.showMessage(message, 'success');
        console.log(`🔄 ${message}`);
        
        // Update status info
        this.updateMovementStatusInfo();
        
        // If enabling, force an immediate movement update to show it's working
        if (this.movementSimulationEnabled) {
            console.log('🟢 Running immediate movement test since simulation was just enabled...');
            setTimeout(() => {
                this.simulateVehicleMovement();
            }, 1000);
        }
    }
    
    // Add function to quickly enable some drivers for testing
    enableTestDrivers() {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        let enabledCount = 0;
        
        drivers.forEach(driver => {
            if (driver.approved && !driver.online && enabledCount < 5) {
                driver.online = true;
                driver.lastSeen = Date.now();
                
                // Ensure they have a location
                if (!driver.location) {
                    const iraqLocations = [
                        { lat: 33.3152, lng: 44.3661 }, // Baghdad
                        { lat: 36.1911, lng: 44.0094 }, // Erbil
                        { lat: 35.5492, lng: 45.4394 }, // Sulaymaniyah
                        { lat: 30.5085, lng: 47.7804 }, // Basra
                    ];
                    const randomLocation = iraqLocations[Math.floor(Math.random() * iraqLocations.length)];
                    driver.location = {
                        lat: randomLocation.lat + (Math.random() - 0.5) * 0.05,
                        lng: randomLocation.lng + (Math.random() - 0.5) * 0.05,
                        timestamp: Date.now()
                    };
                }
                enabledCount++;
            }
        });
        
        if (enabledCount > 0) {
            localStorage.setItem('drivers', JSON.stringify(drivers));
            this.loadVehicles();
            this.loadAdminData();
            this.showMessage(`${enabledCount} drivers set online for testing`, 'success');
            console.log(`Enabled ${enabledCount} test drivers for movement simulation`);
        } else {
            this.showMessage('No offline approved drivers available', 'warning');
        }
    }
    
    // Add function to update movement status info
    updateMovementStatusInfo() {
        const statusDiv = document.querySelector('.alert.alert-info');
        if (statusDiv) {
            const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
            const onlineDrivers = drivers.filter(d => d.approved && d.online).length;
            const simulationStatus = this.movementSimulationEnabled ? 'ACTIVE' : 'DISABLED';
            
            statusDiv.innerHTML = `
                <i class="fas fa-info-circle"></i>
                <strong>Real-time Tracking Status:</strong> Movement simulation is <strong>${simulationStatus}</strong>. 
                ${onlineDrivers} drivers online. 
                ${this.movementSimulationEnabled ? 
                    'Vehicles move automatically every 15 seconds.' : 
                    'Only real driver updates will move vehicles.'}
                Use "Force Movement" to trigger immediate updates.
            `;
        }
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
                
                // Set realistic location within Iraq for movement simulation
                const iraqLocations = [
                    { lat: 33.3152, lng: 44.3661, city: 'Baghdad' },
                    { lat: 36.1911, lng: 44.0094, city: 'Erbil' },
                    { lat: 35.5492, lng: 45.4394, city: 'Sulaymaniyah' },
                    { lat: 30.5085, lng: 47.7804, city: 'Basra' },
                    { lat: 36.3350, lng: 43.1189, city: 'Mosul' }
                ];
                
                const randomLocation = iraqLocations[Math.floor(Math.random() * iraqLocations.length)];
                driverData.location = {
                    lat: randomLocation.lat + (Math.random() - 0.5) * 0.05, // Small random offset
                    lng: randomLocation.lng + (Math.random() - 0.5) * 0.05,
                    timestamp: Date.now()
                };
                driverData.country = 'IQ';
                driverData.governorate = randomLocation.city;
                
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
                console.log('New driver added:', driverData.name, 'Location:', driverData.location);
            }
            
            // Refresh admin data and map
            setTimeout(() => {
                this.loadAdminData();
                this.loadVehicles(); // Refresh map to show new driver if online
                this.closeDriverModal();
            }, 1500);
            
        } catch (error) {
            console.error('Error saving driver:', error);
            this.showMessage('Error saving driver: ' + error.message, 'danger', 'driver-modal-message');
        }
    }

    async toggleDriverOnlineStatus(driverId) {
        try {
            console.log('Toggling driver online status for driver ID:', driverId);
            
            const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
            const index = drivers.findIndex(d => d.id === driverId);
            
            if (index === -1) {
                console.error('Driver not found with ID:', driverId);
                this.showMessage('Driver not found', 'danger');
                return false;
            }
            
            const driver = drivers[index];
            const newStatus = !driver.online;
            
            console.log('Driver found:', {
                name: driver.name,
                currentStatus: driver.online,
                newStatus: newStatus
            });
            
            // Update driver status
            drivers[index].online = newStatus;
            drivers[index].lastSeen = Date.now();
            
            // If going online, update location
            if (newStatus) {
                try {
                    const location = await this.getCurrentLocation();
                    drivers[index].location = location;
                    console.log('Updated driver location:', location);
                } catch (error) {
                    console.warn('Could not update location:', error);
                    // Continue anyway - driver can still go online without location
                }
            }
            
            localStorage.setItem('drivers', JSON.stringify(drivers));
            
            // Update current driver if it's the same one
            if (this.currentDriver && this.currentDriver.id === driverId) {
                this.currentDriver.online = newStatus;
                this.currentDriver.lastSeen = Date.now();
                if (newStatus && drivers[index].location) {
                    this.currentDriver.location = drivers[index].location;
                }
            }
            
            // Update UI
            this.updateDriverDashboard();
            
            // Refresh the vehicles on map
            this.loadVehicles();
            this.loadAdminData();
            
            const statusText = newStatus ? 'online' : 'offline';
            this.showMessage(
                `Driver ${driver.name} is now ${statusText}`, 
                'success'
            );
            
            console.log('Driver status updated successfully:', {
                driverName: driver.name,
                newStatus: newStatus
            });
            
            return true;
            
        } catch (error) {
            console.error('Error toggling driver status:', error);
            this.showMessage('Error updating driver status', 'danger');
            return false;
        }
    }

    updateDriverDashboard() {
        if (this.currentDriver) {
            this.updateDriverStatus();
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
                    <i class="fas fa-info-circle"></i> No pending taxi driver approvals
                    <br><small>Note: Only taxi drivers require admin approval. Other vehicle types are auto-approved.</small>
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
            drivers[index].lastSeen = Date.now();
            
            // Ensure the driver has a valid location for movement simulation
            if (!drivers[index].location || !drivers[index].location.timestamp) {
                // Set a default location within Iraq if none exists
                drivers[index].location = {
                    lat: 33.3152 + (Math.random() - 0.5) * 0.1, // Random location near Baghdad
                    lng: 44.3661 + (Math.random() - 0.5) * 0.1,
                    timestamp: Date.now()
                };
                console.log('Set default location for approved driver:', drivers[index].name);
            }
            
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
            console.log('Driver approved:', drivers[index].name, 'Location:', drivers[index].location);
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
        // Stop real-time location tracking if active
        this.stopRealtimeLocationUpdates();
        
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
        
        // Update dashboard every 30 seconds if admin is logged in
        setInterval(() => {
            if (this.currentAdmin) {
                this.updateDashboardStats();
            }
        }, 30000);
        
        // Demo vehicle movement simulation (for testing purposes)
        this.startDemoMovement();
    }

    // Real-time location tracking functions
    startRealtimeLocationUpdates() {
        console.log('Starting real-time location updates...');
        
        if (this.locationWatchId) {
            this.stopRealtimeLocationUpdates();
        }
        
        if (navigator.geolocation) {
            this.locationWatchId = navigator.geolocation.watchPosition(
                position => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    console.log('Real-time location update:', { lat, lng });
                    
                    // Validate location is within Iraq
                    if (isPointInIraq(lat, lng)) {
                        this.updateDriverLocationInDatabase(lat, lng);
                    } else {
                        console.warn('Driver moved outside Iraq boundaries, going offline');
                        this.goOfflineOutsideIraq();
                    }
                },
                error => {
                    console.error('Real-time location error:', error);
                    if (error.code === error.PERMISSION_DENIED) {
                        this.showMessage('Location permission denied. Going offline.', 'warning');
                        this.goOfflineLocationError();
                    }
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 30000, // 30 seconds
                    timeout: 15000      // 15 seconds
                }
            );
            
            this.showMessage('Real-time location tracking started', 'success');
        } else {
            this.showMessage('Geolocation not supported', 'danger');
        }
    }
    
    stopRealtimeLocationUpdates() {
        if (this.locationWatchId) {
            console.log('Stopping real-time location updates...');
            navigator.geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = null;
            this.showMessage('Real-time location tracking stopped', 'info');
        }
    }
    
    async updateDriverLocationInDatabase(lat, lng) {
        try {
            if (this.currentDriver) {
                const location = {
                    lat: lat,
                    lng: lng,
                    timestamp: Date.now()
                };
                
                this.currentDriver.location = location;
                this.currentDriver.lastSeen = Date.now();
                
                await this.updateDriverData(this.currentDriver);
                
                // Update the map to show new position
                this.loadVehicles();
                
                console.log('Driver location updated in database:', location);
            }
        } catch (error) {
            console.error('Error updating driver location:', error);
        }
    }
    
    async goOfflineOutsideIraq() {
        try {
            this.currentDriver.online = false;
            this.currentDriver.lastSeen = Date.now();
            
            await this.updateDriverData(this.currentDriver);
            this.updateDriverStatus();
            this.stopRealtimeLocationUpdates();
            
            document.getElementById('online-toggle').checked = false;
            this.showMessage('Automatically went offline: Outside Iraq boundaries', 'warning');
        } catch (error) {
            console.error('Error going offline:', error);
        }
    }
    
    async goOfflineLocationError() {
        try {
            this.currentDriver.online = false;
            this.currentDriver.lastSeen = Date.now();
            
            await this.updateDriverData(this.currentDriver);
            this.updateDriverStatus();
            this.stopRealtimeLocationUpdates();
            
            document.getElementById('online-toggle').checked = false;
        } catch (error) {
            console.error('Error going offline:', error);
        }
    }
    
    startDemoMovement() {
        console.log('🚀 Starting demo movement simulation...');
        console.log('Movement will run every 15 seconds for approved online drivers');
        
        // Initial status log
        this.logMovementStatus();
        
        // Simulate vehicle movement every 15 seconds for demo purposes
        setInterval(() => {
            this.simulateVehicleMovement();
        }, 15000);
        
        // Log status every minute
        setInterval(() => {
            this.logMovementStatus();
        }, 60000);
    }
    
    logMovementStatus() {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const approved = drivers.filter(d => d.approved);
        const online = approved.filter(d => d.online);
        const withLocation = online.filter(d => d.location);
        
        console.log(`📊 Movement Status: ${drivers.length} total, ${approved.length} approved, ${online.length} online, ${withLocation.length} with location`);
        
        if (withLocation.length > 0) {
            console.log('🚗 Vehicles ready for movement:');
            withLocation.forEach(driver => {
                console.log(`  • ${driver.name} (${driver.vehicleType}) at ${driver.location.lat.toFixed(4)},${driver.location.lng.toFixed(4)}`);
            });
        }
    }
    
    simulateVehicleMovement() {
        // Check if movement simulation is enabled (default: true)
        if (this.movementSimulationEnabled === false) {
            console.log('Movement simulation disabled - skipping');
            return;
        }
        
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        let updated = false;
        let movedCount = 0;
        
        console.log(`Starting movement simulation for ${drivers.length} total drivers`);
        
        drivers.forEach(driver => {
            // Only simulate movement for APPROVED online drivers
            if (driver.approved && driver.online && driver.location) {
                console.log(`Processing driver: ${driver.name} (${driver.vehicleType}) - Approved: ${driver.approved}, Online: ${driver.online}`);
                
                // Create realistic movement within Iraq boundaries
                const newLocation = this.generateRealisticMovement(driver.location, driver.vehicleType);
                
                // Validate the new location is still within Iraq
                if (isPointInIraq(newLocation.lat, newLocation.lng)) {
                    const oldLat = driver.location.lat;
                    const oldLng = driver.location.lng;
                    
                    driver.location = {
                        lat: newLocation.lat,
                        lng: newLocation.lng,
                        timestamp: Date.now()
                    };
                    driver.lastSeen = Date.now();
                    updated = true;
                    movedCount++;
                    
                    // Log movement for debugging
                    console.log(`✅ Moved ${driver.name} (${driver.vehicleType}): ${oldLat.toFixed(4)},${oldLng.toFixed(4)} → ${newLocation.lat.toFixed(4)},${newLocation.lng.toFixed(4)}`);
                } else {
                    console.warn(`❌ New location for ${driver.name} is outside Iraq boundaries: ${newLocation.lat.toFixed(4)},${newLocation.lng.toFixed(4)}`);
                }
            } else {
                console.log(`⏸️ Skipping driver ${driver.name}: Approved=${driver.approved}, Online=${driver.online}, HasLocation=${!!driver.location}`);
            }
        });
        
        // Save updated positions
        if (updated) {
            localStorage.setItem('drivers', JSON.stringify(drivers));
            // Refresh map to show new positions
            this.loadVehicles();
            console.log(`🚗 Movement simulation: ${movedCount} vehicles moved successfully`);
        } else {
            console.log('⚠️ Movement simulation: No vehicles to move (none online/approved)');
        }
    }
    
    generateRealisticMovement(currentLocation, vehicleType) {
        // Different movement patterns for different vehicle types
        const movementRanges = {
            taxi: 0.005,        // ~500m movement
            minibus: 0.003,     // ~300m movement  
            'tuk-tuk': 0.002,   // ~200m movement
            van: 0.004,         // ~400m movement
            bus: 0.001          // ~100m movement (buses move slower)
        };
        
        const range = movementRanges[vehicleType] || 0.003;
        
        // Generate random movement within realistic bounds
        const latChange = (Math.random() - 0.5) * range;
        const lngChange = (Math.random() - 0.5) * range;
        
        const newLocation = {
            lat: currentLocation.lat + latChange,
            lng: currentLocation.lng + lngChange
        };
        
        // Ensure the new location stays within Iraq's general bounds
        newLocation.lat = Math.max(29.0, Math.min(37.5, newLocation.lat));
        newLocation.lng = Math.max(38.7, Math.min(48.8, newLocation.lng));
        
        console.log(`📏 Generated movement for ${vehicleType}: ${currentLocation.lat.toFixed(4)},${currentLocation.lng.toFixed(4)} → ${newLocation.lat.toFixed(4)},${newLocation.lng.toFixed(4)} (range: ${range})`);
        
        return newLocation;
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
        
        // Update statistics - only taxi drivers need approval
        this.dashboardStats.totalDrivers = drivers.length;
        this.dashboardStats.onlineDrivers = drivers.filter(d => d.online && d.approved).length;
        this.dashboardStats.pendingApprovals = drivers.filter(d => !d.approved && d.vehicleType === 'taxi').length;
        
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
    
    // Vehicle Type Management Functions
    loadVehicleTypesForManagement() {
        const vehicleTypes = this.getVehicleTypes();
        this.populateVehicleTypesTable(vehicleTypes);
    }
    
    getVehicleTypes() {
        const stored = localStorage.getItem('vehicleTypes');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Return default vehicle types
        const defaultTypes = [
            { id: 'taxi', name: 'Taxi', icon: '🚕', color: '#FFD700', enabled: true },
            { id: 'minibus', name: 'Minibus', icon: '🚐', color: '#4CAF50', enabled: true },
            { id: 'tuk-tuk', name: 'Tuk-tuk', icon: '🛽', color: '#FF9800', enabled: true },
            { id: 'van', name: 'Van', icon: '🚐', color: '#2196F3', enabled: true },
            { id: 'bus', name: 'Bus', icon: '🚌', color: '#F44336', enabled: true }
        ];
        
        this.saveVehicleTypes(defaultTypes);
        return defaultTypes;
    }
    
    saveVehicleTypes(vehicleTypes) {
        localStorage.setItem('vehicleTypes', JSON.stringify(vehicleTypes));
        // Refresh the vehicle filters on the map
        this.loadVehicleTypes();
        // Update any dropdowns that use vehicle types
        this.updateVehicleTypeDropdowns(vehicleTypes);
    }
    
    populateVehicleTypesTable(vehicleTypes) {
        const tbody = document.getElementById('vehicle-types-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        vehicleTypes.forEach(type => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="font-size: 1.5rem; text-align: center;">${type.icon}</td>
                <td><code>${type.id}</code></td>
                <td>${type.name}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 20px; height: 20px; background: ${type.color}; border-radius: 3px;"></div>
                        <span>${type.color}</span>
                    </div>
                </td>
                <td>
                    <span class="badge badge-${type.enabled ? 'success' : 'secondary'}">
                        ${type.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="btn btn-sm" style="background: var(--warning-color); color: white;" 
                                onclick="app.editVehicleType('${type.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-${type.enabled ? 'warning' : 'success'}" 
                                onclick="app.toggleVehicleType('${type.id}')" 
                                title="${type.enabled ? 'Disable' : 'Enable'}">
                            <i class="fas fa-${type.enabled ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" 
                                onclick="app.deleteVehicleType('${type.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
        });
    }
    
    addVehicleType() {
        const id = document.getElementById('new-vehicle-id').value.trim();
        const name = document.getElementById('new-vehicle-name').value.trim();
        const icon = document.getElementById('new-vehicle-icon').value.trim();
        const color = document.getElementById('new-vehicle-color').value;
        
        // Validation
        if (!id || !name || !icon) {
            this.showMessage('Please fill all required fields', 'danger', 'vehicle-management-message');
            return;
        }
        
        if (!/^[a-z-]+$/.test(id)) {
            this.showMessage('Vehicle ID must contain only lowercase letters and hyphens', 'danger', 'vehicle-management-message');
            return;
        }
        
        const vehicleTypes = this.getVehicleTypes();
        
        // Check if ID already exists
        if (vehicleTypes.find(type => type.id === id)) {
            this.showMessage('Vehicle ID already exists', 'danger', 'vehicle-management-message');
            return;
        }
        
        // Add new vehicle type
        const newType = {
            id: id,
            name: name,
            icon: icon,
            color: color,
            enabled: true
        };
        
        vehicleTypes.push(newType);
        this.saveVehicleTypes(vehicleTypes);
        this.populateVehicleTypesTable(vehicleTypes);
        
        // Clear form
        document.getElementById('new-vehicle-id').value = '';
        document.getElementById('new-vehicle-name').value = '';
        document.getElementById('new-vehicle-icon').value = '';
        document.getElementById('new-vehicle-color').value = '#FF5722';
        
        this.showMessage(`Vehicle type "${name}" added successfully!`, 'success', 'vehicle-management-message');
    }
    
    editVehicleType(id) {
        const vehicleTypes = this.getVehicleTypes();
        const type = vehicleTypes.find(t => t.id === id);
        
        if (!type) {
            this.showMessage('Vehicle type not found', 'danger', 'vehicle-management-message');
            return;
        }
        
        const newName = prompt('Enter new name:', type.name);
        if (newName === null) return; // User cancelled
        
        if (!newName.trim()) {
            this.showMessage('Name cannot be empty', 'danger', 'vehicle-management-message');
            return;
        }
        
        const newIcon = prompt('Enter new icon:', type.icon);
        if (newIcon === null) return; // User cancelled
        
        if (!newIcon.trim()) {
            this.showMessage('Icon cannot be empty', 'danger', 'vehicle-management-message');
            return;
        }
        
        const newColor = prompt('Enter new color (hex):', type.color);
        if (newColor === null) return; // User cancelled
        
        if (!newColor.trim() || !/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
            this.showMessage('Please enter a valid hex color (e.g., #FF5722)', 'danger', 'vehicle-management-message');
            return;
        }
        
        // Update the type
        type.name = newName.trim();
        type.icon = newIcon.trim();
        type.color = newColor.trim();
        
        this.saveVehicleTypes(vehicleTypes);
        this.populateVehicleTypesTable(vehicleTypes);
        
        this.showMessage(`Vehicle type "${type.name}" updated successfully!`, 'success', 'vehicle-management-message');
    }
    
    toggleVehicleType(id) {
        const vehicleTypes = this.getVehicleTypes();
        const type = vehicleTypes.find(t => t.id === id);
        
        if (!type) {
            this.showMessage('Vehicle type not found', 'danger', 'vehicle-management-message');
            return;
        }
        
        type.enabled = !type.enabled;
        
        this.saveVehicleTypes(vehicleTypes);
        this.populateVehicleTypesTable(vehicleTypes);
        
        const status = type.enabled ? 'enabled' : 'disabled';
        this.showMessage(`Vehicle type "${type.name}" ${status} successfully!`, 'success', 'vehicle-management-message');
    }
    
    deleteVehicleType(id) {
        const vehicleTypes = this.getVehicleTypes();
        const type = vehicleTypes.find(t => t.id === id);
        
        if (!type) {
            this.showMessage('Vehicle type not found', 'danger', 'vehicle-management-message');
            return;
        }
        
        // Check if any drivers are using this vehicle type
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        const driversUsingType = drivers.filter(d => d.vehicleType === id);
        
        if (driversUsingType.length > 0) {
            const confirmation = confirm(
                `Warning: ${driversUsingType.length} driver(s) are currently using this vehicle type.\n\n` +
                `Deleting this type will affect their profiles. Are you sure you want to continue?`
            );
            
            if (!confirmation) return;
        } else {
            const confirmation = confirm(`Are you sure you want to delete the vehicle type "${type.name}"?`);
            if (!confirmation) return;
        }
        
        // Remove the vehicle type
        const updatedTypes = vehicleTypes.filter(t => t.id !== id);
        this.saveVehicleTypes(updatedTypes);
        this.populateVehicleTypesTable(updatedTypes);
        
        this.showMessage(`Vehicle type "${type.name}" deleted successfully!`, 'success', 'vehicle-management-message');
    }
    
    updateVehicleTypeDropdowns(vehicleTypes) {
        // Update registration form dropdown
        const registrationSelect = document.getElementById('vehicle-type');
        if (registrationSelect) {
            const currentValue = registrationSelect.value;
            registrationSelect.innerHTML = '<option value="">Select Vehicle Type</option>';
            
            vehicleTypes.filter(type => type.enabled).forEach(type => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = `${type.icon} ${type.name}`;
                registrationSelect.appendChild(option);
            });
            
            // Restore selected value if it still exists
            if (vehicleTypes.find(t => t.id === currentValue && t.enabled)) {
                registrationSelect.value = currentValue;
            }
        }
        
        // Update modal dropdown
        const modalSelect = document.getElementById('modal-vehicle-type');
        if (modalSelect) {
            const currentValue = modalSelect.value;
            modalSelect.innerHTML = '<option value="">Select Vehicle Type</option>';
            
            vehicleTypes.filter(type => type.enabled).forEach(type => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = `${type.icon} ${type.name}`;
                modalSelect.appendChild(option);
            });
            
            // Restore selected value if it still exists
            if (vehicleTypes.find(t => t.id === currentValue && t.enabled)) {
                modalSelect.value = currentValue;
            }
        }
    }
    
    // Add function to ensure demo drivers exist for testing
    ensureDemoDriversExist() {
        const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
        
        if (drivers.length === 0) {
            console.log('🛠️ No drivers found, creating demo drivers for testing...');
            
            const demoDrivers = [
                {
                    id: Date.now().toString() + '1',
                    name: 'Ahmed Al-Baghdadi',
                    email: 'ahmed@demo.com',
                    phone: '+964 770 123 4567',
                    licenseNumber: 'BGD001',
                    plate: 'بغداد 1234',
                    vehicleType: 'taxi',
                    password: 'demo123',
                    approved: true,
                    online: true,
                    location: {
                        lat: 33.3152 + (Math.random() - 0.5) * 0.1,
                        lng: 44.3661 + (Math.random() - 0.5) * 0.1,
                        timestamp: Date.now()
                    },
                    registeredAt: Date.now(),
                    lastSeen: Date.now(),
                    country: 'IQ'
                },
                {
                    id: Date.now().toString() + '2',
                    name: 'Fatima Al-Basri',
                    email: 'fatima@demo.com',
                    phone: '+964 771 234 5678',
                    licenseNumber: 'BSR002',
                    plate: 'البصرة 5678',
                    vehicleType: 'minibus',
                    routeFrom: 'Al-Basra',
                    routeTo: 'Baghdad',
                    password: 'demo123',
                    approved: true,
                    online: true,
                    location: {
                        lat: 30.5085 + (Math.random() - 0.5) * 0.1,
                        lng: 47.7804 + (Math.random() - 0.5) * 0.1,
                        timestamp: Date.now()
                    },
                    registeredAt: Date.now(),
                    lastSeen: Date.now(),
                    country: 'IQ'
                },
                {
                    id: Date.now().toString() + '3',
                    name: 'Omar Al-Kurdi',
                    email: 'omar@demo.com',
                    phone: '+964 772 345 6789',
                    licenseNumber: 'ERB003',
                    plate: 'أربيل 9876',
                    vehicleType: 'van',
                    password: 'demo123',
                    approved: true,
                    online: true,
                    location: {
                        lat: 36.1911 + (Math.random() - 0.5) * 0.1,
                        lng: 44.0094 + (Math.random() - 0.5) * 0.1,
                        timestamp: Date.now()
                    },
                    registeredAt: Date.now(),
                    lastSeen: Date.now(),
                    country: 'IQ'
                }
            ];
            
            localStorage.setItem('drivers', JSON.stringify(demoDrivers));
            console.log(`✅ Created ${demoDrivers.length} demo drivers for testing`);
            console.log('Demo drivers:', demoDrivers.map(d => `${d.name} (${d.vehicleType})`).join(', '));
        } else {
            const onlineDrivers = drivers.filter(d => d.approved && d.online).length;
            console.log(`📊 Found ${drivers.length} existing drivers, ${onlineDrivers} online and approved`);
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

// Mobile menu functions
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('mobile-menu-btn');
    const isVisible = menu.style.display === 'block';
    
    if (isVisible) {
        menu.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-bars"></i>';
    } else {
        menu.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-times"></i>';
    }
}

// Big online/offline button function
function toggleBigOnlineButton() {
    console.log('=== BIG BUTTON CLICKED ===');
    console.log('Window.app exists:', !!window.app);
    console.log('Current driver exists:', !!(window.app && window.app.currentDriver));
    
    if (!window.app) {
        console.error('App not initialized');
        alert('App is loading, please wait and try again.');
        return;
    }
    
    if (!window.app.currentDriver) {
        console.error('No current driver logged in');
        alert('Please log in as a driver first.');
        return;
    }
    
    const currentStatus = window.app.currentDriver.online;
    const newStatus = !currentStatus;
    
    console.log('Toggling driver status:', {
        driverName: window.app.currentDriver.name,
        driverId: window.app.currentDriver.id,
        fromStatus: currentStatus,
        toStatus: newStatus,
        hasLocation: !!window.app.currentDriver.location
    });
    
    // Disable button temporarily to prevent double-clicks
    const button = document.getElementById('big-online-btn');
    if (button) {
        console.log('Disabling button temporarily...');
        button.disabled = true;
        button.style.opacity = '0.6';
        
        // Re-enable after operation
        setTimeout(() => {
            if (button) {
                button.disabled = false;
                button.style.opacity = '1';
                console.log('Button re-enabled');
            }
        }, 3000); // Give more time for the operation
    } else {
        console.error('Big button element not found!');
    }
    
    try {
        window.app.toggleDriverOnlineStatus(window.app.currentDriver.id);
    } catch (error) {
        console.error('Error calling toggleDriverOnlineStatus:', error);
        // Re-enable button immediately on error
        if (button) {
            button.disabled = false;
            button.style.opacity = '1';
        }
        alert('Error updating status. Please try again.');
    }
}

// Debug function to check drivers
function debugDrivers() {
    const drivers = JSON.parse(localStorage.getItem('drivers') || '[]');
    console.log('=== ALL DRIVERS DEBUG ===');
    console.log('Total drivers:', drivers.length);
    drivers.forEach((driver, index) => {
        console.log(`${index + 1}. ${driver.name} - Online: ${driver.online} - Approved: ${driver.approved} - Location: ${driver.location ? 'Yes' : 'No'}`);
    });
    
    if (window.app && window.app.currentDriver) {
        console.log('Current logged in driver:', window.app.currentDriver.name);
        console.log('Current driver online:', window.app.currentDriver.online);
    }
    
    alert(`Found ${drivers.length} drivers. Check console for details.`);
}

// Debug function to check big button state
function debugBigButton() {
    console.log('=== BIG BUTTON DEBUG ===');
    const button = document.getElementById('big-online-btn');
    console.log('Button element exists:', !!button);
    
    if (button) {
        console.log('Button details:', {
            disabled: button.disabled,
            className: button.className,
            onclick: button.onclick ? 'Function assigned' : 'No onclick',
            style: button.style.cssText,
            innerHTML: button.innerHTML ? 'Has content' : 'No content'
        });
    }
    
    console.log('Window.app exists:', !!window.app);
    console.log('Current driver exists:', !!(window.app && window.app.currentDriver));
    
    if (window.app && window.app.currentDriver) {
        console.log('Current driver status:', {
            name: window.app.currentDriver.name,
            online: window.app.currentDriver.online,
            location: window.app.currentDriver.location
        });
    }
    
    const dashboard = document.getElementById('driver-dashboard');
    console.log('Driver dashboard visible:', dashboard ? dashboard.style.display !== 'none' : false);
    
    alert('Big button debug info logged to console');
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('mobile-menu-btn');
    menu.style.display = 'none';
    btn.innerHTML = '<i class="fas fa-bars"></i>';
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('mobile-menu-btn');
    
    if (menu && btn && menu.style.display === 'block') {
        if (!menu.contains(event.target) && !btn.contains(event.target)) {
            closeMobileMenu();
        }
    }
});

// Initialize NEXŞE when page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    window.app = new IraqVehicleTracker();
    app = window.app; // Keep both for compatibility
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IraqVehicleTracker;
}