# 🛍️ Noshahi Mart - 3D E-commerce ERP Dashboard

A professional, modern E-commerce ERP Admin Dashboard built with Angular 17, featuring stunning 3D glassmorphism design and comprehensive admin/seller functionality.

## ✨ Features

### 🎨 Visual Design
- **3D Glassmorphism UI** with stunning visual effects
- **Gradient backgrounds** and smooth animations
- **3D shadows** and hover transformations
- **Responsive design** that works on all devices
- **Modern Inter font** and clean typography

### 🏗️ Architecture
- **Angular 17** with standalone components
- **TypeScript** for type safety
- **SCSS** for advanced styling
- **Component-based** architecture
- **Clean folder structure**

### 👥 User Roles
- **Admin Panel** - Complete store management
- **Seller Panel** - Individual seller dashboard

### 📊 Admin Features
- **Dashboard** - Sales analytics and metrics
- **Products Management** - Inventory control
- **Categories** - Product categorization
- **Orders** - Order processing and tracking
- **Customers** - Customer management
- **Sellers** - Seller oversight
- **Finance** - Payment and expense tracking
- **Reports** - Business analytics
- **Users & Roles** - Permission management
- **Settings** - System configuration

### 🛍️ Seller Features
- **Seller Dashboard** - Personal analytics
- **My Products** - Product catalog management
- **Orders** - Order fulfillment
- **Earnings** - Revenue tracking
- **Profile** - Account settings

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Angular CLI (v17 or higher)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd noshahi-mart
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
ng serve
```

4. Open your browser and navigate to `http://localhost:4200/`

## 🏗️ Project Structure

```
src/
├── app/
│   ├── components/          # Reusable UI components
│   │   ├── sidebar/        # 3D navigation sidebar
│   │   ├── header/         # 3D header with search
│   │   └── footer/         # 3D footer component
│   ├── pages/              # Feature pages
│   │   ├── admin/          # Admin panel pages
│   │   │   ├── dashboard/  # Admin dashboard
│   │   │   └── products/   # Products management
│   │   └── seller/         # Seller panel pages
│   │       └── dashboard/  # Seller dashboard
│   ├── app.html            # Main layout template
│   ├── app.css             # Main layout styles
│   ├── app.ts              # Main app component
│   └── app.routes.ts       # Routing configuration
├── styles.css              # Global styles and design system
└── main.ts                 # Application bootstrap
```

## 🎨 Design System

The application uses a comprehensive 3D glassmorphism design system:

### Color Palette
- **Primary Gradient**: `#667eea` to `#764ba2`
- **Secondary Gradient**: `#f093fb` to `#f5576c`
- **Accent Gradient**: `#4facfe` to `#00f2fe`

### Glassmorphism Effects
- **Background Blur**: `backdrop-filter: blur(20px)`
- **Transparent Backgrounds**: `rgba(255, 255, 255, 0.1)`
- **3D Shadows**: Custom shadow utilities
- **Border Effects**: `rgba(255, 255, 255, 0.2)`

### 3D Transformations
- **Hover Effects**: `translateY(-5px) rotateX(5deg)`
- **Card Float**: Smooth elevation animations
- **Interactive Elements**: Dynamic response to user interaction

## 📱 Responsive Design

The dashboard is fully responsive with breakpoints at:
- **Desktop**: 1200px+
- **Tablet**: 768px - 1199px
- **Mobile**: < 768px

## 🔧 Development

### Available Scripts

```bash
# Start development server
ng serve

# Build for production
ng build

# Run tests
ng test

# Run end-to-end tests
ng e2e
```

### Component Generation

```bash
# Generate a new component
ng generate component component-name

# Generate with standalone flag
ng generate component component-name --standalone
```

## 🎯 Key Components

### 3D Sidebar
- Collapsible navigation
- Role-based menu items
- Smooth animations
- User profile section

### 3D Header
- Global search functionality
- Notification system
- User menu
- Quick stats display

### Dashboard Cards
- 3D hover effects
- Real-time data display
- Interactive charts
- Performance metrics

## 🔄 State Management

Currently using Angular's built-in state management. Can be extended with:
- NgRx for complex state
- Signals for reactive state
- Services for shared state

## 🚀 Deployment

### Build for Production

```bash
ng build --configuration production
```

The build artifacts will be stored in the `dist/` directory.

### Deployment Options

- **Static Hosting**: Vercel, Netlify, GitHub Pages
- **Cloud Hosting**: AWS S3, Google Cloud Storage
- **Server Hosting**: Node.js, Express, Docker

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Angular Team for the amazing framework
- Glassmorphism design inspiration
- 3D UI/UX design patterns

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
