plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "org.playtime.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "org.playtime.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // gomobile bind 生成的 Go 服务（scripts/build-android.sh 产出）。
    implementation(files("libs/playtime.aar"))

    // 只要 onBackPressedDispatcher / ComponentActivity，避免引入 AppCompat。
    implementation("androidx.activity:activity:1.8.1")
}
