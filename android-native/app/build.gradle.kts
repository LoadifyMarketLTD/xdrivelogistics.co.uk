plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

fun secretProperty(name: String): String? =
    (project.findProperty(name) as String?)?.takeIf { it.isNotBlank() }
        ?: System.getenv(name)?.takeIf { it.isNotBlank() }

val xdriveBaseUrl = (project.findProperty("XDRIVE_BASE_URL") as String?) ?: "https://www.xdrivelogistics.co.uk"
val supabaseUrl = (project.findProperty("XDRIVE_SUPABASE_URL") as String?) ?: ""
val supabaseAnonKey = (project.findProperty("XDRIVE_SUPABASE_ANON_KEY") as String?) ?: ""
val firebaseProjectId = secretProperty("XDRIVE_FIREBASE_PROJECT_ID") ?: ""
val firebaseApplicationId = secretProperty("XDRIVE_FIREBASE_APPLICATION_ID") ?: ""
val firebaseApiKey = secretProperty("XDRIVE_FIREBASE_API_KEY") ?: ""
val firebaseSenderId = secretProperty("XDRIVE_FIREBASE_SENDER_ID") ?: ""
val firebaseClientConfigComplete = listOf(
    firebaseProjectId,
    firebaseApplicationId,
    firebaseApiKey,
    firebaseSenderId,
).all { it.isNotBlank() }

val releaseKeystorePath = secretProperty("XDRIVE_ANDROID_KEYSTORE_PATH")
val releaseStorePassword = secretProperty("XDRIVE_ANDROID_STORE_PASSWORD")
val releaseKeyAlias = secretProperty("XDRIVE_ANDROID_KEY_ALIAS")
val releaseKeyPassword = secretProperty("XDRIVE_ANDROID_KEY_PASSWORD")
val releaseSigningComplete = listOf(
    releaseKeystorePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }
val releaseTaskRequested = gradle.startParameter.taskNames.any { task ->
    task.contains("release", ignoreCase = true) || task.contains("bundle", ignoreCase = true)
}

if (releaseTaskRequested && !releaseSigningComplete) {
    throw org.gradle.api.GradleException(
        "Production Android signing is not configured. Recover/verify the existing Play upload-key lineage, then provide " +
            "XDRIVE_ANDROID_KEYSTORE_PATH, XDRIVE_ANDROID_STORE_PASSWORD, XDRIVE_ANDROID_KEY_ALIAS and XDRIVE_ANDROID_KEY_PASSWORD. " +
            "Do not generate an unrelated replacement key merely to make the build pass.",
    )
}

if (releaseTaskRequested && !firebaseClientConfigComplete) {
    throw org.gradle.api.GradleException(
        "Production Firebase Cloud Messaging is not configured. Provide " +
            "XDRIVE_FIREBASE_PROJECT_ID, XDRIVE_FIREBASE_APPLICATION_ID, XDRIVE_FIREBASE_API_KEY and XDRIVE_FIREBASE_SENDER_ID " +
            "for the Firebase Android app registered to co.uk.xdrivelogistics.driver before building a release.",
    )
}

android {
    namespace = "co.uk.xdrivelogistics.driver"
    compileSdk = 35

    defaultConfig {
        applicationId = "co.uk.xdrivelogistics.driver"
        minSdk = 26
        targetSdk = 35
        // Production version codes use YYYYMMDD as a monotonic baseline. This
        // intentionally exceeds every historical Native/Expo value in the repo
        // (1/2) while remaining well below Android's maximum versionCode.
        versionCode = 20260826
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "XDRIVE_BASE_URL", "\"$xdriveBaseUrl\"")
        buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"$firebaseProjectId\"")
        buildConfigField("String", "FIREBASE_APPLICATION_ID", "\"$firebaseApplicationId\"")
        buildConfigField("String", "FIREBASE_API_KEY", "\"$firebaseApiKey\"")
        buildConfigField("String", "FIREBASE_SENDER_ID", "\"$firebaseSenderId\"")
    }

    signingConfigs {
        if (releaseSigningComplete) {
            create("release") {
                storeFile = file(requireNotNull(releaseKeystorePath))
                storePassword = requireNotNull(releaseStorePassword)
                keyAlias = requireNotNull(releaseKeyAlias)
                keyPassword = requireNotNull(releaseKeyPassword)
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (releaseSigningComplete) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.02")
    val firebaseBom = platform("com.google.firebase:firebase-bom:34.18.0")

    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation(firebaseBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("androidx.navigation:navigation-compose:2.8.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")

    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")

    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("com.google.firebase:firebase-messaging")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:core-ktx:1.6.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
