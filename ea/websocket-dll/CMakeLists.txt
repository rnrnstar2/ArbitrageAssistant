cmake_minimum_required(VERSION 3.15)
project(HedgeSystemWebSocket)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# プロジェクトの設定
if(WIN32)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4")
    add_definitions(-DHEDGESYSTEMWEBSOCKET_EXPORTS)
else()
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -fPIC")
    add_definitions(-DHEDGESYSTEMWEBSOCKET_EXPORTS)
endif()

# 依存関係の検索
find_package(Threads REQUIRED)
find_package(OpenSSL REQUIRED)

# websocketpp の検索（システムにインストールされている場合）
find_path(WEBSOCKETPP_INCLUDE_DIR websocketpp/config/asio_client.hpp
    PATHS
    /opt/homebrew/include
    /usr/local/include
    /usr/include
)

if(NOT WEBSOCKETPP_INCLUDE_DIR)
    message(STATUS "websocketpp not found in system, downloading...")
    
    # websocketppは実行時には必要ないヘッダーオンリーライブラリなので、
    # ヘッダーファイルのみをダウンロード
    include(FetchContent)
    FetchContent_Declare(
        websocketpp
        GIT_REPOSITORY https://github.com/zaphoyd/websocketpp.git
        GIT_TAG        0.8.2
        CONFIGURE_COMMAND ""
        BUILD_COMMAND ""
        INSTALL_COMMAND ""
    )
    FetchContent_GetProperties(websocketpp)
    if(NOT websocketpp_POPULATED)
        FetchContent_Populate(websocketpp)
    endif()
    set(WEBSOCKETPP_INCLUDE_DIR ${websocketpp_SOURCE_DIR})
endif()

# Asio の検索
find_path(ASIO_INCLUDE_DIR asio.hpp)

if(NOT ASIO_INCLUDE_DIR)
    message(STATUS "asio not found in system, downloading...")
    
    include(FetchContent)
    FetchContent_Declare(
        asio
        GIT_REPOSITORY https://github.com/chriskohlhoff/asio.git
        GIT_TAG        asio-1-24-0
    )
    FetchContent_MakeAvailable(asio)
    set(ASIO_INCLUDE_DIR ${asio_SOURCE_DIR}/asio/include)
endif()

# ソースファイル
set(SOURCES
    HedgeSystemWebSocket.cpp
    HedgeSystemWebSocket.h
)

# 共有ライブラリ（DLL）の作成
add_library(${PROJECT_NAME} SHARED ${SOURCES})

# インクルードディレクトリの設定
target_include_directories(${PROJECT_NAME} PRIVATE
    ${WEBSOCKETPP_INCLUDE_DIR}
    ${ASIO_INCLUDE_DIR}
    ${OPENSSL_INCLUDE_DIR}
)

# リンクライブラリの設定
if(WIN32)
    target_link_libraries(${PROJECT_NAME} PRIVATE
        ${OPENSSL_LIBRARIES}
        ws2_32
        wsock32
        crypt32
        Threads::Threads
    )
else()
    target_link_libraries(${PROJECT_NAME} PRIVATE
        ${OPENSSL_LIBRARIES}
        Threads::Threads
    )
endif()

# プリプロセッサの定義
target_compile_definitions(${PROJECT_NAME} PRIVATE
    ASIO_STANDALONE
    _WEBSOCKETPP_CPP11_STL_
    _WEBSOCKETPP_CPP11_RANDOM_DEVICE_
    _WEBSOCKETPP_CPP11_FUNCTIONAL_
)

# Windows固有の設定
if(WIN32)
    # DEFファイルの作成（エクスポート関数の定義）
    set(DEF_FILE "${CMAKE_CURRENT_BINARY_DIR}/HedgeSystemWebSocket.def")
    file(WRITE ${DEF_FILE} "EXPORTS\n")
    file(APPEND ${DEF_FILE} "WSConnect\n")
    file(APPEND ${DEF_FILE} "WSDisconnect\n")
    file(APPEND ${DEF_FILE} "WSSendMessage\n")
    file(APPEND ${DEF_FILE} "WSReceiveMessage\n")
    file(APPEND ${DEF_FILE} "WSIsConnected\n")
    file(APPEND ${DEF_FILE} "WSGetLastError\n")
    file(APPEND ${DEF_FILE} "WSFreeString\n")
    
    set_target_properties(${PROJECT_NAME} PROPERTIES
        LINK_FLAGS "/DEF:${DEF_FILE}"
    )
    
    # 出力ファイル名の設定
    set_target_properties(${PROJECT_NAME} PROPERTIES
        OUTPUT_NAME "HedgeSystemWebSocket"
        PREFIX ""
        SUFFIX ".dll"
    )
endif()

# インストール設定
install(TARGETS ${PROJECT_NAME}
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
)

install(FILES HedgeSystemWebSocket.h
    DESTINATION include
)

# テストの有効化（オプション）
option(BUILD_TESTS "Build tests" OFF)

if(BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()