#!/bin/bash

# 🚀 Arun Karyana Store - Phase 1 Deployment Script
# This script will help you push all the changes to GitHub

echo "=============================================="
echo "🚀 ARUN KARYANA STORE - DEPLOYMENT SCRIPT"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: Not in the correct directory!"
    echo "Please run this script from the webapp directory."
    exit 1
fi

echo "✅ Directory check passed"
echo ""

# Check git status
echo "📊 Checking git status..."
git status
echo ""

# Show commits to be pushed
echo "📦 Commits ready to push:"
git log origin/main..HEAD --oneline
echo ""

# Ask for confirmation
echo "=============================================="
echo "You are about to push 5 commits to GitHub:"
echo ""
echo "1. Backend enhancements (Cloudinary, SendGrid, Sentry)"
echo "2. Complete admin dashboard rebuild"
echo "3. Phase 1 setup guide"
echo "4. Completion summary"
echo "5. Quick reference card"
echo ""
echo "=============================================="
echo ""
read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled."
    exit 0
fi

echo ""
echo "🔄 Pushing to GitHub..."
echo ""

# Try to push
if git push origin main; then
    echo ""
    echo "=============================================="
    echo "✅ SUCCESS! Code pushed to GitHub"
    echo "=============================================="
    echo ""
    echo "🎯 Next Steps:"
    echo ""
    echo "1. ✅ Code is now in GitHub"
    echo "2. 🔄 Render will auto-deploy (check dashboard)"
    echo "3. ⚙️  Set up services (follow PHASE1_SETUP_GUIDE.md)"
    echo "4. 🎨 Deploy frontend to Netlify"
    echo "5. 🧪 Test everything!"
    echo ""
    echo "📚 Read these files for instructions:"
    echo "   - PHASE1_COMPLETION_SUMMARY.md (overview)"
    echo "   - PHASE1_SETUP_GUIDE.md (detailed setup)"
    echo "   - QUICK_REFERENCE.md (quick access)"
    echo ""
    echo "🔗 Your GitHub repository:"
    echo "   https://github.com/Khushi6211/AKS"
    echo ""
    echo "=============================================="
else
    echo ""
    echo "=============================================="
    echo "❌ PUSH FAILED - Authentication Error"
    echo "=============================================="
    echo ""
    echo "This usually means GitHub needs authentication."
    echo ""
    echo "🔧 Solution 1: Use GitHub CLI (Recommended)"
    echo ""
    echo "1. Install GitHub CLI:"
    echo "   sudo apt update"
    echo "   sudo apt install gh"
    echo ""
    echo "2. Authenticate:"
    echo "   gh auth login"
    echo ""
    echo "3. Run this script again"
    echo ""
    echo "--------------------------------------------"
    echo ""
    echo "🔧 Solution 2: Use Personal Access Token"
    echo ""
    echo "1. Create token at:"
    echo "   https://github.com/settings/tokens"
    echo ""
    echo "2. Generate new token (classic)"
    echo "   - Select scopes: repo, workflow"
    echo "   - Copy the token"
    echo ""
    echo "3. Run: git push origin main"
    echo "   - Username: Khushi6211"
    echo "   - Password: [paste your token]"
    echo ""
    echo "=============================================="
    exit 1
fi
