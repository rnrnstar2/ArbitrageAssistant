#!/bin/bash

# WebSocket DLL Build Script for Unix-like systems (macOS/Linux)
# Usage: ./build.sh [clean]

set -e

echo "=== WebSocket DLL Build Script ==="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Clean option
if [ "$1" == "clean" ]; then
    echo "Cleaning build directory..."
    rm -rf build/
    print_success "Clean complete"
    exit 0
fi

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo "Detected OS: macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo "Detected OS: Linux"
else
    print_error "Unsupported OS: $OSTYPE"
    exit 1
fi

# Check for required tools
echo
echo "Checking dependencies..."

# Check CMake
if ! command -v cmake &> /dev/null; then
    print_error "CMake not found!"
    echo "Please install CMake:"
    if [ "$OS" == "macos" ]; then
        echo "  brew install cmake"
    else
        echo "  sudo apt-get install cmake"
    fi
    exit 1
fi
print_success "CMake found: $(cmake --version | head -1)"

# Check compiler
if ! command -v g++ &> /dev/null && ! command -v clang++ &> /dev/null; then
    print_error "C++ compiler not found!"
    echo "Please install a C++ compiler:"
    if [ "$OS" == "macos" ]; then
        echo "  xcode-select --install"
    else
        echo "  sudo apt-get install build-essential"
    fi
    exit 1
fi

if command -v clang++ &> /dev/null; then
    CXX_COMPILER="clang++"
    print_success "C++ compiler found: $(clang++ --version | head -1)"
else
    CXX_COMPILER="g++"
    print_success "C++ compiler found: $(g++ --version | head -1)"
fi

# Check OpenSSL
OPENSSL_ROOT=""
if [ "$OS" == "macos" ]; then
    # macOS: Check Homebrew locations
    if [ -d "/opt/homebrew/opt/openssl" ]; then
        OPENSSL_ROOT="/opt/homebrew/opt/openssl"
    elif [ -d "/usr/local/opt/openssl" ]; then
        OPENSSL_ROOT="/usr/local/opt/openssl"
    fi
    
    if [ -z "$OPENSSL_ROOT" ]; then
        print_warning "OpenSSL not found in Homebrew"
        echo "Trying to install OpenSSL..."
        brew install openssl
        
        # Re-check after installation
        if [ -d "/opt/homebrew/opt/openssl" ]; then
            OPENSSL_ROOT="/opt/homebrew/opt/openssl"
        elif [ -d "/usr/local/opt/openssl" ]; then
            OPENSSL_ROOT="/usr/local/opt/openssl"
        fi
    fi
else
    # Linux: Use pkg-config
    if pkg-config --exists openssl; then
        OPENSSL_ROOT="system"
    else
        print_error "OpenSSL not found!"
        echo "Please install OpenSSL:"
        echo "  sudo apt-get install libssl-dev"
        exit 1
    fi
fi

if [ -n "$OPENSSL_ROOT" ]; then
    if [ "$OPENSSL_ROOT" == "system" ]; then
        print_success "OpenSSL found: system installation"
    else
        print_success "OpenSSL found: $OPENSSL_ROOT"
    fi
fi

# Create build directory
echo
echo "Creating build directory..."
mkdir -p build
cd build

# Run CMake
echo
echo "Configuring with CMake..."

CMAKE_ARGS="-DCMAKE_BUILD_TYPE=Release"
CMAKE_ARGS="$CMAKE_ARGS -DCMAKE_CXX_COMPILER=$CXX_COMPILER"

if [ "$OS" == "macos" ] && [ "$OPENSSL_ROOT" != "system" ]; then
    CMAKE_ARGS="$CMAKE_ARGS -DOPENSSL_ROOT_DIR=$OPENSSL_ROOT"
    CMAKE_ARGS="$CMAKE_ARGS -DOPENSSL_CRYPTO_LIBRARY=$OPENSSL_ROOT/lib/libcrypto.dylib"
    CMAKE_ARGS="$CMAKE_ARGS -DOPENSSL_SSL_LIBRARY=$OPENSSL_ROOT/lib/libssl.dylib"
fi

cmake .. $CMAKE_ARGS

if [ $? -ne 0 ]; then
    print_error "CMake configuration failed!"
    exit 1
fi
print_success "CMake configuration complete"

# Build
echo
echo "Building WebSocket DLL..."
cmake --build . --config Release -- -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1)

if [ $? -ne 0 ]; then
    print_error "Build failed!"
    exit 1
fi

# Check output
echo
echo "=== Build Complete ==="
echo "Output files:"

if [ "$OS" == "macos" ]; then
    LIBRARY_FILE="libHedgeSystemWebSocket.dylib"
else
    LIBRARY_FILE="libHedgeSystemWebSocket.so"
fi

if [ -f "$LIBRARY_FILE" ]; then
    ls -la "$LIBRARY_FILE"
    print_success "Library built successfully: $LIBRARY_FILE"
    
    # Get library info
    echo
    echo "Library information:"
    if [ "$OS" == "macos" ]; then
        otool -L "$LIBRARY_FILE" | head -10
    else
        ldd "$LIBRARY_FILE" | head -10
    fi
else
    print_error "Library file not found!"
    exit 1
fi

# Create a simple test to verify the library can be loaded
echo
echo "Creating load test..."
cat > test_load.cpp << 'EOF'
#include <iostream>
#include <dlfcn.h>

int main() {
    const char* libname = "./libHedgeSystemWebSocket.so";
#ifdef __APPLE__
    libname = "./libHedgeSystemWebSocket.dylib";
#endif
    
    void* handle = dlopen(libname, RTLD_LAZY);
    if (!handle) {
        std::cerr << "Failed to load library: " << dlerror() << std::endl;
        return 1;
    }
    
    std::cout << "Library loaded successfully!" << std::endl;
    
    // Try to get a function pointer
    void* func = dlsym(handle, "WSConnect");
    if (func) {
        std::cout << "WSConnect function found!" << std::endl;
    }
    
    dlclose(handle);
    return 0;
}
EOF

$CXX_COMPILER -o test_load test_load.cpp -ldl

if ./test_load; then
    print_success "Library load test passed!"
else
    print_error "Library load test failed!"
fi

cd ..

echo
print_success "Build completed successfully!"
echo
echo "Library location: $(pwd)/build/$LIBRARY_FILE"
echo
echo "To use this library:"
echo "1. For development: export LD_LIBRARY_PATH=\$LD_LIBRARY_PATH:$(pwd)/build"
echo "2. For MT5: Copy the library to the appropriate MT5 Libraries folder"
echo "3. Make sure all dependencies are available on the target system"