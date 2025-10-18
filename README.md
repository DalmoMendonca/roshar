# 🌟 Roshar Character Creator

> **AI-Powered Character Generation for Brandon Sanderson's Cosmere RPG**

An advanced web application that leverages cutting-edge AI technology to create immersive, lore-accurate character profiles for tabletop RPG campaigns set in the world of Roshar from *The Stormlight Archive*.

![Character Creator Demo](https://img.shields.io/badge/Status-Production%20Ready-brightgreen) ![AI Powered](https://img.shields.io/badge/AI-GPT--5%20%7C%20DALL--E-blue) ![Framework](https://img.shields.io/badge/Framework-Vanilla%20JS-yellow)

---

## 🚀 **Key Features**

### **🤖 Advanced AI Integration**
- **GPT-5 Responses API** for contextually-aware character generation
- **Intelligent PDF Processing** - Automatically uploads and processes the *Welcome to Roshar* worldbuilding guide for accurate lore integration
- **Multi-Strategy JSON Parsing** with robust error handling and fallback mechanisms
- **DALL-E Image Generation** with iterative refinement capabilities

### **⚡ Sophisticated Version Control System**
- **Real-time Version Tracking** for every character field with intelligent state management
- **Granular History Navigation** - Navigate between blank, user-edited, and AI-generated versions
- **Smart Duplicate Prevention** - Automatically prevents identical versions from cluttering history
- **Visual State Indicators** - Purple highlighting for AI-generated content with smooth transitions

### **🎨 Professional UI/UX**
- **Modal Text Expansion** - Full-screen editing for detailed character descriptions
- **Responsive Grid Layout** - Desktop side-by-side image/controls, mobile-optimized stacking
- **Field Locking During Generation** - Prevents user interference during AI processing
- **Cosmere-Themed Design** with custom fonts (*Cinzel*, *Crimson Text*) and color palette

### **📄 High-Quality PDF Export**
- **Ultra-High Resolution Image Processing** (1200px canvas) with PNG quality preservation
- **Intelligent Text Wrapping** around character portraits with proper spacing
- **Professional Layout Engine** using jsPDF with custom typography and formatting
- **Dynamic Content Organization** - Character sheet on page 1, detailed bio on page 2

### **🔧 Production-Ready Architecture**
- **Environment-Aware Configuration** - Seamless local development and production deployment
- **Netlify Auto-Deployment** with build-time environment variable injection
- **Secure API Key Management** - Git-safe configuration with template system
- **Comprehensive Error Handling** with user-friendly feedback

---

## 🛠 **Technical Implementation**

### **AI & API Integration**
```javascript
// Advanced multi-strategy JSON parsing with fallback mechanisms
const strategies = [
    () => JSON.parse(cleanText),
    () => JSON.parse(cleanText.replace(/\\"/g, '\u0022')),
    () => JSON.parse(cleanText.replace(/"([^"]*\\[^"]*[^"]*?)"/g, 
        (match, content) => '"' + content.replace(/\\"/g, "'") + '"'))
];
```

### **Intelligent Version Management**
```javascript
// Captures original state before AI modification for accurate version history
function saveAIVersionWithOriginal(field, originalValue, aiValue) {
    // Prevents duplicate versions while maintaining chronological accuracy
    if (originalValue !== lastVersion.value) {
        history.push({
            value: originalValue,
            type: originalValue.trim() ? 'user' : 'blank'
        });
    }
}
```

### **High-Performance Image Processing**
```javascript
// Ultra-high resolution canvas rendering for crisp PDF output
canvas.width = 1200; // 4x standard resolution
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const imageData = canvas.toDataURL('image/png'); // Lossless quality
```

---

## 🎯 **Core Functionality**

| Feature | Implementation | Benefit |
|---------|---------------|---------|
| **Contextual AI Generation** | PDF upload + GPT-5 Responses API | Lore-accurate character creation |
| **Version Control** | Field-level history with state tracking | Non-destructive editing workflow |
| **Image Refinement** | Iterative DALL-E prompting | Perfect character visualization |
| **PDF Export** | High-res canvas + jsPDF | Professional character sheets |
| **Responsive Design** | CSS Grid + Mobile-first approach | Universal device compatibility |

---

## 🚀 **Quick Start**

### **Local Development**
```bash
# Clone the repository
git clone https://github.com/DalmoMendonca/roshar.git
cd roshar

# Configure API access
cp config.template.js config.js
# Add your OpenAI API key to config.js

# Launch application
open index.html
```

### **Production Deployment**
```bash
# Deploy to Netlify with automatic environment handling
netlify deploy --prod --dir .

# Environment variables are automatically injected via build-config.js
```

---

## 🏗 **Architecture Highlights**

- **Zero Dependencies** - Pure vanilla JavaScript for maximum performance
- **Modular Design** - Separation of concerns with dedicated modules for AI, UI, and PDF generation
- **Progressive Enhancement** - Graceful degradation for various browser capabilities
- **Security-First** - API keys never exposed in client code or git history
- **Performance Optimized** - Lazy loading, efficient DOM manipulation, and optimized asset delivery

---

## 🎨 **Design Philosophy**

This application demonstrates advanced frontend engineering principles:

- **User-Centric Design** - Every interaction is optimized for the tabletop RPG workflow
- **Technical Excellence** - Production-grade error handling, state management, and API integration
- **Scalable Architecture** - Easily extensible for additional RPG systems or AI capabilities
- **Professional Polish** - Attention to detail in typography, spacing, and visual hierarchy

---

## 📊 **Technical Specifications**

- **Frontend**: Vanilla JavaScript ES6+, CSS3 Grid/Flexbox, HTML5
- **AI Integration**: OpenAI GPT-5 Responses API, DALL-E Image Generation
- **PDF Generation**: jsPDF with high-resolution canvas rendering
- **Deployment**: Netlify with automated build pipeline
- **Browser Support**: Modern browsers with ES6+ support

---

## 👨‍💻 **Developer**

**Dalmo Mendonça**  
📧 [dalmomendonca@gmail.com](mailto:dalmomendonca@gmail.com)

*Showcasing advanced frontend development, AI integration, and user experience design*

---

<div align="center">

**[🌐 Live Demo](https://roshar-character-creator.netlify.app)** | **[📖 Documentation](https://github.com/DalmoMendonca/roshar/wiki)** | **[🐛 Issues](https://github.com/DalmoMendonca/roshar/issues)**

</div>