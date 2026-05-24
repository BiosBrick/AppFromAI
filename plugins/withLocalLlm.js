const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const PLUGIN_DIR = __dirname;

// ── 1. Gradle dependencies ────────────────────────────────────────────────────

function withLocalLlmGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // 1. Inject dependencies
    if (!contents.includes('litertlm-android')) {
      const deps = [
        '    // LiteRT-LM on-device inference (Google AI Edge Gallery)',
        '    implementation("com.google.ai.edge.litertlm:litertlm-android:0.11.0")',
        '    implementation("com.google.android.gms:play-services-tflite-java:16.4.0")',
        '    implementation("com.google.android.gms:play-services-tflite-gpu:16.4.0")',
        '    implementation("com.google.android.gms:play-services-tflite-support:16.4.0")',
      ].join('\n');
      contents = contents.replace(/\}\s*$/, deps + '\n}\n');
    }

    // 2. Inject kotlinOptions with metadata-version-check skip
    if (!contents.includes('freeCompilerArgs')) {
      const kotlinOpts = [
        '    kotlinOptions {',
        '        jvmTarget = "17"',
        '        freeCompilerArgs += ["-Xskip-metadata-version-check"]',
        '    }',
      ].join('\n');
      // Insert just before the closing brace of the android { } block
      contents = contents.replace(
        /(androidResources\s*\{[^}]*\}\s*\n)(\})/,
        (_, androidRes, closingBrace) => androidRes + kotlinOpts + '\n' + closingBrace
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

// ── 2. Kotlin source files + MainApplication patch ───────────────────────────

function withLocalLlmFiles(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const packageName = (mod.android && mod.android.package) || 'com.afi.appfromai';
      const packagePath = packageName.replace(/\./g, '/');
      const packageDir = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/java',
        packagePath
      );

      // Copy LocalLlmModule.kt and LocalLlmPackage.kt from plugins/
      for (const file of ['LocalLlmModule.kt', 'LocalLlmPackage.kt']) {
        fs.copyFileSync(
          path.join(PLUGIN_DIR, file),
          path.join(packageDir, file)
        );
      }

      // Patch MainApplication.kt — register LocalLlmPackage
      const mainAppPath = path.join(packageDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let src = fs.readFileSync(mainAppPath, 'utf8');
        if (!src.includes('LocalLlmPackage')) {
          src = src.replace(
            'PackageList(this).packages.apply {',
            'PackageList(this).packages.apply {\n              add(LocalLlmPackage())'
          );
          fs.writeFileSync(mainAppPath, src);
        }
      }

      return mod;
    },
  ]);
}

module.exports = (config) => withLocalLlmFiles(withLocalLlmGradle(config));
