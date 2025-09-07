# NISHAN

A comprehensive real-time vehicle tracking system specifically designed for Iraq, featuring live vehicle location tracking, driver registration with geographic validation, and an admin panel for managing drivers and vehicle types.

## 🌟 Features

### Core Functionality
- **Real-time Vehicle Tracking**: Live vehicle locations on interactive map using Leaflet and OpenStreetMap
- **Iraq-Only Enforcement**: Geographic validation ensures all registrations and operations are within Iraq boundaries
- **Vehicle Type Support**: Taxi, Minibus, Tuk-tuk, Van, and Bus with custom icons
- **Simplified Interface**: Clean, focused interface showing all available vehicles
- **Clustering**: Intelligent marker clustering for better map performance
- **Mobile-First Design**: Responsive interface optimized for mobile devices

### Driver Features
- **Registration System**: Secure driver registration with Iraq location validation
- **Online/Offline Status**: Real-time status updates with location tracking
- **Vehicle-Specific Fields**: Bus routes, taxi numbers, and other type-specific information
- **Location Updates**: Automatic and manual location updates with Iraq boundary validation

### Admin Features
- **Driver Approval**: Approve/reject driver registrations
- **Live Monitoring**: View all drivers, their status, and locations
- **Vehicle Type Management**: Add/remove vehicle types and customize icons
- **Analytics Dashboard**: Driver statistics and system metrics

### Security & Privacy
- **Geographic Boundaries**: Strict Iraq-only operation enforcement
- **Authentication**: Secure login system for drivers and administrators
- **Rate Limiting**: Protection against spam registrations and location updates
- **Privacy Controls**: Driver contact information only shown when vehicle is selected

## 🚀 Quick Start

### Prerequisites
- Modern web browser with geolocation support
- Internet connection for map tiles and libraries
- Optional: Firebase account for production deployment

### Local Development
1. **Clone/Download** the project files
2. **Open** `index.html` in a web browser
3. **Load Demo Data** (optional):
   ```javascript
   // Open browser console and run:
   loadDemoData();
   ```
4. **Start Testing** with the following credentials:
   - **Admin Login**: 
   - **Demo Driver**: Any email from demo data / demo123

### File Structure
```
nishan/
├── index.html              # Main application interface
├── app.js                  # Core application logic
├── iraq-boundary.js        # Iraq geographic boundary data
├── firebase-config.js      # Firebase configuration and database structure
├── demo-data.js           # Sample data for testing
├── README.md              # This documentation
└── tests/                 # Test files (optional)
```

## 🛠️ Configuration

### Firebase Setup (Production)
1. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create new project named "nishan"
   - Enable Authentication and Realtime Database

2. **Configure Authentication**:
   - Enable Email/Password authentication
   - Set up admin users in Firebase Console

3. **Update Configuration**:
   ```javascript
   // In firebase-config.js, replace with your config:
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-rtdb.firebaseio.com/",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

4. **Set Database Rules**:
   ```json
   {
     "rules": {
       "drivers": {
         ".read": true,
         "$driverId": {
           ".write": "$driverId === auth.uid"
         }
       },
       "locations": {
         ".read": true,
         "$driverId": {
           ".write": "$driverId === auth.uid"
         }
       }
     }
   }
   ```

## 🌐 Deployment Options

### Firebase Hosting (Recommended)
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
firebase init hosting

# Deploy
firebase deploy
```

### Netlify
1. Create account at [Netlify](https://netlify.com)
2. Drag and drop project folder
3. Configure custom domain (optional)

### Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Traditional Web Hosting
Upload all files to any web hosting service that supports static files.

## 📱 Usage Guide

### For Users
1. **View Map**: See all available vehicles in your area
2. **Find Location**: Click "Find My Location" to center map on your position
3. **Contact Drivers**: Click vehicle markers to see contact information
4. **All Vehicle Types**: View all approved online drivers without filtering

### For Drivers
1. **Register**: Fill registration form with accurate information
2. **Wait for Approval**: Admin will review and approve your application
3. **Login**: Use approved credentials to access driver panel
4. **Go Online**: Toggle online status to appear on map
5. **Update Location**: Keep location current for accurate tracking

### For Administrators
1. **Login**: Use admin credentials to access dashboard
2. **Review Applications**: Approve or reject pending driver registrations
3. **Monitor Drivers**: View all drivers, their status, and locations
4. **Manage System**: Add/remove vehicle types and configure settings

## 🧪 Testing

### Manual Testing Checklist
- [ ] Driver registration with valid Iraq location
- [ ] Driver registration rejection outside Iraq
- [ ] Admin approval/rejection workflow
- [ ] Real-time location updates
- [ ] Mobile responsiveness
- [ ] Map marker clustering
- [ ] Online/offline status changes
- [ ] Simplified interface without filtering

### Demo Data
Load sample data for testing:
```javascript
// In browser console:
loadDemoData(); // Adds 25+ demo vehicles
clearAllData(); // Removes all data
```

### Test Accounts
- **Admin**: euzardi@gmail.com / Sarchnar1
- **Driver**: Any demo driver email / demo123

## 📊 System Architecture

### Frontend
- **Leaflet**: Interactive maps with OpenStreetMap tiles
- **Vanilla JavaScript**: No framework dependencies for maximum compatibility
- **Responsive CSS**: Mobile-first design with CSS Grid and Flexbox
- **Real-time Updates**: Polling-based updates every 10 seconds

### Backend Options
- **Demo Mode**: localStorage for testing and development
- **Firebase**: Realtime Database for production deployment
- **Custom API**: RESTful API with your preferred backend technology

### Geographic Features
- **Iraq Boundary**: GeoJSON polygon for precise boundary checking
- **Governorate Support**: Coverage for all 18 Iraqi governorates
- **Coordinate Validation**: Point-in-polygon algorithm for location verification

## 🔧 Customization

### Adding Vehicle Types
```javascript
// In firebase-config.js or admin panel:
const newVehicleType = {
  id: "motorcycle",
  name: "Motorcycle", 
  icon: "🏍️",
  color: "#9C27B0",
  enabled: true
};
```

### Modifying Search Radius
```javascript
// In app.js, modify default values:
this.searchRadius = 10; // Default radius in km
maxRadius: 50, // Maximum allowed radius
```

### Customizing Map Style
```javascript
// Replace OpenStreetMap with other tile providers:
L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors, Tiles courtesy of Humanitarian OpenStreetMap Team'
}).addTo(this.map);
```

## 🐛 Troubleshooting

### Common Issues

**Map not loading**:
- Check internet connection
- Verify browser geolocation permissions
- Check console for JavaScript errors

**Location not updating**:
- Ensure HTTPS (required for geolocation)
- Check browser location permissions
- Verify Iraq boundary validation

**Firebase connection issues**:
- Verify Firebase configuration
- Check database rules
- Ensure authentication is properly set up

**Performance issues**:
- Reduce vehicle update frequency
- Increase clustering radius
- Implement geohash-based queries

### Browser Support
- **Chrome**: 60+
- **Firefox**: 55+
- **Safari**: 12+
- **Edge**: 79+
- **Mobile**: iOS 12+, Android 7+

## 📈 Performance Optimization

### Frontend Optimizations
- Marker clustering for large datasets
- Lazy loading of vehicle data
- Efficient DOM updates
- CSS optimization for mobile

### Backend Optimizations
- Geohash indexing for spatial queries
- Rate limiting for API endpoints
- Caching for static data
- Pagination for large datasets

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Make changes and test thoroughly
4. Submit pull request with detailed description

### Code Standards
- Use semicolons and consistent indentation
- Add comments for complex logic
- Follow existing naming conventions
- Test on multiple browsers and devices

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 📞 Support

For technical support or questions:
- **Email**: support@iraq-vehicle-tracker.com
- **Documentation**: See inline code comments
- **Issues**: Report bugs and feature requests via GitHub Issues

## 🔗 Resources

- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [Firebase Documentation](https://firebase.google.com/docs)
- [GeoJSON Specification](https://geojson.org/)
- [OpenStreetMap](https://www.openstreetmap.org/)

## 🚧 Roadmap

### Phase 1 (Current)
- [x] Basic vehicle tracking
- [x] Iraq boundary validation
- [x] Admin panel
- [x] Mobile responsive design

### Phase 2 (Planned)
- [ ] Push notifications for drivers
- [ ] Route optimization
- [ ] Driver ratings and reviews
- [ ] Payment integration

### Phase 3 (Future)
- [ ] AI-powered demand prediction
- [ ] Multi-language support (Arabic/Kurdish)
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations

---


**Built with ❤️ for Iraq's transportation needs**
