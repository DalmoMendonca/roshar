# Roshar Character Creator

> **AI-Powered Character Generation for Brandon Sanderson's Cosmere RPG**

A simple web application that leverages gen AI technology to create lore-accurate character profiles for tabletop RPG campaigns set in the world of Roshar from *The Stormlight Archive*.

![Character Creator Demo](https://img.shields.io/badge/Status-Production%20Ready-brightgreen) ![AI Powered](https://img.shields.io/badge/AI-GPT--5%20%7C%20DALL--E-blue) ![Framework](https://img.shields.io/badge/Framework-Vanilla%20JS-yellow)

---

## **Key Features**

### **AI Integration**
- **GPT-5 Responses API** for contextually-aware character generation
- **Intelligent PDF Processing** automatically uploads and processes the *Welcome to Roshar* worldbuilding guide for accurate lore integration
- **Multi-Strategy JSON Parsing** with robust error handling and fallback mechanisms
- **Sora Image Generation** with iterative refinement capabilities

### **Version Control System**
- **Real-time Version Tracking** for every character field with state management
- **Granular History Navigation** between blank, user-edited, and AI-generated versions
- **Visual State Indicators** - Purple highlighting for AI-generated content

### **UI/UX**
- **Modal Text Expansion** - Full-screen editing for detailed character descriptions
- **Responsive Grid Layout** - Desktop side-by-side image/controls, mobile-optimized stacking
- **Field Locking During Generation** - Prevents user interference during AI processing
- **Cosmere-Themed Design** with custom fonts (*Cinzel*, *Crimson Text*) and color palette

### **PDF Export**
- **High Resolution Image Processing** (1200px canvas) with PNG quality preservation
- **Intelligent Text Wrapping** around character portraits with proper spacing
- **Layout Engine** using jsPDF with custom typography and formatting

---

## **Technical Implementation**

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

### **Version Management**
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

### **Image Processing**
```javascript
// Ultra-high resolution canvas rendering for crisp PDF output
canvas.width = 1200; // 4x standard resolution
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const imageData = canvas.toDataURL('image/png'); // Lossless quality
```

## **Core Functionality**

| Feature | Implementation | Benefit |
|---------|---------------|---------|
| **Contextual AI Generation** | PDF upload + GPT-5 Responses API | Lore-accurate character creation |
| **Version Control** | Field-level history with state tracking | Non-destructive editing workflow |
| **Image Refinement** | Iterative DALL-E prompting | Perfect character visualization |
| **PDF Export** | High-res canvas + jsPDF | Professional character sheets |
| **Responsive Design** | CSS Grid + Mobile-first approach | Universal device compatibility |

## **Technical Specifications**

- **Frontend**: Vanilla JavaScript ES6+, CSS3 Grid/Flexbox, HTML5
- **AI Integration**: OpenAI GPT-5 Responses API, DALL-E Image Generation
- **PDF Generation**: jsPDF with high-resolution canvas rendering
- **Deployment**: Netlify with automated build pipeline
- **Browser Support**: Modern browsers with ES6+ support

<div align="center">

**[🌐 Live Demo](https://ewlcometoroshar.com)** | **[📖 Documentation](https://github.com/DalmoMendonca/roshar/wiki)** | **[🐛 Issues](https://github.com/DalmoMendonca/roshar/issues)**

</div>