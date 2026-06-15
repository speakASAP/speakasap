#!/usr/bin/env node
/* Post-deploy rendered QA for the seven-course frontend.
 *
 * This script intentionally runs only after deployment/cutover approval. It
 * requires Playwright to be installed in the execution environment and writes
 * screenshots/reports outside the repository by default.
 */
const fs = require("fs");
const path = require("path");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const envName = name.toUpperCase().replace(/-/g, "_");
  return process.env[envName] || fallback;
}

function loadPlaywright() {
  const candidates = [
    "playwright",
    "playwright-core",
    path.join(__dirname, "..", "frontend", "node_modules", "playwright"),
    path.join(__dirname, "..", "frontend", "node_modules", "playwright-core"),
  ];
  const errors = [];
  for (const candidate of candidates) {
    try {
      return { module: require(candidate), moduleName: candidate };
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  const error = new Error(errors.join("\n"));
  error.code = "PLAYWRIGHT_MODULE_NOT_FOUND";
  throw error;
}

function chromeExecutablePath() {
  const configured = arg("chrome-executable", "");
  const candidates = [
    configured,
    process.env.CHROME_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

async function main() {
  const baseUrl = arg("base-url", "https://speakasap.alfares.cz").replace(/\/+$/, "");
  const languageCode = arg("language-code", "en");
  const lessonOrder = arg("lesson-order", "1");
  const reportPath = arg("json-report", "/tmp/speakasap-seven-postdeploy-visual-qa-v1.json");
  const screenshotDir = arg("screenshot-dir", "/tmp/speakasap-seven-visual-qa");
  const selfTest = arg("self-test", "false") === "true";
  const courseUrl = `${baseUrl}/${languageCode}/seven`;
  const lessonUrl = `${baseUrl}/${languageCode}/seven/${lessonOrder}`;
  fs.mkdirSync(screenshotDir, { recursive: true });

  let chromium;
  let playwrightModuleName;
  try {
    const loaded = loadPlaywright();
    ({ chromium } = loaded.module);
    playwrightModuleName = loaded.moduleName;
  } catch (error) {
    const report = {
      generatedAt: new Date().toISOString(),
      writes: false,
      ok: false,
      error: "Playwright or playwright-core is required for rendered post-deploy visual QA",
      detail: String(error && error.message ? error.message : error),
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.exit(2);
  }

  const executablePath = chromeExecutablePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const results = [];
  const consoleEntries = [];
  const viewports = [
    { name: "desktop", width: 1440, height: 1100 },
    { name: "mobile", width: 390, height: 844 },
  ];

  async function checkPage(page, url, viewportName, kind) {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const title = await page.title();
    const screenshot = path.join(screenshotDir, `${kind}-${viewportName}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const data = await page.evaluate(() => {
      const root = document.querySelector(".seven-page");
      const lessonContent = document.querySelector(".lesson__content--seven");
      const readableText = document.querySelector(".lesson__content--seven p, .lesson__content--seven li");
      const courseHeader = document.querySelector(".seven-course-header");
      const courseHeaderTitle = document.querySelector(".seven-course-header h1");
      const courseHeaderText = document.querySelector(".seven-course-header p");
      const lessonCardTitle = document.querySelector(".seven-lesson-card h2");
      const promoList = document.querySelector(".seven-app-promo ul");
      const tableCell = document.querySelector(".lesson__content table td, .lesson__content table th");
      const exerciseTitle = document.querySelector(".exercises__title");
      const h1 = document.querySelector(".lesson__content h1, .seven-course-header h1");
      const h2 = document.querySelector(".lesson__content h2, .seven-exercises > h2");
      const contentStyle = lessonContent ? getComputedStyle(lessonContent) : null;
      const readableTextStyle = readableText ? getComputedStyle(readableText) : null;
      const courseHeaderStyle = courseHeader ? getComputedStyle(courseHeader) : null;
      const courseHeaderTitleStyle = courseHeaderTitle ? getComputedStyle(courseHeaderTitle) : null;
      const courseHeaderTextStyle = courseHeaderText ? getComputedStyle(courseHeaderText) : null;
      const lessonCardTitleStyle = lessonCardTitle ? getComputedStyle(lessonCardTitle) : null;
      const promoListStyle = promoList ? getComputedStyle(promoList) : null;
      const tableCellStyle = tableCell ? getComputedStyle(tableCell) : null;
      const exerciseTitleStyle = exerciseTitle ? getComputedStyle(exerciseTitle) : null;
      const h1Style = h1 ? getComputedStyle(h1) : null;
      const h2Style = h2 ? getComputedStyle(h2) : null;
      const bodyText = document.body ? document.body.innerText : "";
      const rect = lessonContent ? lessonContent.getBoundingClientRect() : null;
      return {
        hasSevenPage: Boolean(root),
        hasLessonContent: Boolean(lessonContent),
        hasReadingIndicator: Boolean(document.querySelector(".seven-reading-indicator")),
        hasPdfButton: Boolean(document.querySelector(".button-download-pdf, .download-pdf")),
        hasPromo: Boolean(document.querySelector(".seven-app-promo")),
        hasCourseHeader: Boolean(courseHeader),
        hasLessonCardTitle: Boolean(lessonCardTitle),
        hasTableCell: Boolean(tableCell),
        hasExerciseTitle: Boolean(exerciseTitle),
        hasFrameworkOverlay: Boolean(document.querySelector("[data-nextjs-dialog-overlay], nextjs-portal")),
        bodyTextLength: bodyText.length,
        bodyColor: contentStyle ? contentStyle.color : null,
        bodyFontFamily: contentStyle ? contentStyle.fontFamily : null,
        bodyFontSize: readableTextStyle ? readableTextStyle.fontSize : (contentStyle ? contentStyle.fontSize : null),
        bodyLineHeight: readableTextStyle ? readableTextStyle.lineHeight : (contentStyle ? contentStyle.lineHeight : null),
        h1Color: h1Style ? h1Style.color : null,
        h1FontFamily: h1Style ? h1Style.fontFamily : null,
        h1FontSize: h1Style ? h1Style.fontSize : null,
        h1LineHeight: h1Style ? h1Style.lineHeight : null,
        h2Color: h2Style ? h2Style.color : null,
        h2FontFamily: h2Style ? h2Style.fontFamily : null,
        h2FontSize: h2Style ? h2Style.fontSize : null,
        courseHeaderColor: courseHeaderTitleStyle ? courseHeaderTitleStyle.color : null,
        courseHeaderFontFamily: courseHeaderTitleStyle ? courseHeaderTitleStyle.fontFamily : null,
        courseHeaderFontSize: courseHeaderTitleStyle ? courseHeaderTitleStyle.fontSize : null,
        courseHeaderLineHeight: courseHeaderTitleStyle ? courseHeaderTitleStyle.lineHeight : null,
        courseHeaderTextFontSize: courseHeaderTextStyle ? courseHeaderTextStyle.fontSize : null,
        courseHeaderTextLineHeight: courseHeaderTextStyle ? courseHeaderTextStyle.lineHeight : null,
        lessonCardTitleColor: lessonCardTitleStyle ? lessonCardTitleStyle.color : null,
        lessonCardTitleFontFamily: lessonCardTitleStyle ? lessonCardTitleStyle.fontFamily : null,
        promoListFontSize: promoListStyle ? promoListStyle.fontSize : null,
        promoListLineHeight: promoListStyle ? promoListStyle.lineHeight : null,
        tableCellFontSize: tableCellStyle ? tableCellStyle.fontSize : null,
        tableCellLineHeight: tableCellStyle ? tableCellStyle.lineHeight : null,
        exerciseTitleFontFamily: exerciseTitleStyle ? exerciseTitleStyle.fontFamily : null,
        exerciseTitleFontSize: exerciseTitleStyle ? exerciseTitleStyle.fontSize : null,
        contentRect: rect ? { width: rect.width, height: rect.height, top: rect.top, left: rect.left } : null,
      };
    });
    const isMobile = viewportName === "mobile";
    const expectedCourseHeaderFontSize = isMobile ? "36px" : "44px";
    const expectedReadableTextFontSize = isMobile ? "15px" : "16px";
    const expectedReadableTextLineHeight = isMobile ? 26 : 30;
    const expectedTableFontSize = isMobile ? "13px" : "16px";
    const expectedTableLineHeight = isMobile ? 19 : 30;
    const readableTextLineHeight = Number.parseFloat(data.bodyLineHeight || "0");
    const tableLineHeight = Number.parseFloat(data.tableCellLineHeight || "0");
    const assertions = {
      urlLoaded: page.url().startsWith(url),
      titlePresent: title.length > 0,
      notBlank: data.bodyTextLength > 500,
      noFrameworkOverlay: data.hasFrameworkOverlay === false,
      sevenPagePresent: data.hasSevenPage === true,
      lessonContentPresent: kind === "course" ? true : data.hasLessonContent === true,
      courseHeaderPresent: kind === "course" ? data.hasCourseHeader === true : true,
      courseHeadingColor: kind === "course" ? data.courseHeaderColor === "rgb(33, 33, 33)" : true,
      courseHeadingFont: kind === "course" ? String(data.courseHeaderFontFamily || "").includes("Open Sans Legacy") : true,
      courseHeadingSize: kind === "course" ? data.courseHeaderFontSize === expectedCourseHeaderFontSize : true,
      courseHeadingReadableLineHeight: kind === "course" ? Number.parseFloat(data.courseHeaderLineHeight || "0") >= 43 : true,
      coursePromoTextSize: kind === "course" ? data.courseHeaderTextFontSize === (viewportName === "mobile" ? "16px" : "18px") : true,
      courseLessonCardHeading: kind === "course" ? data.hasLessonCardTitle === true && data.lessonCardTitleColor === "rgb(44, 150, 255)" && String(data.lessonCardTitleFontFamily || "").includes("PT Mono") : true,
      appPromoListReadable: data.hasPromo ? data.promoListFontSize === "16px" && data.promoListLineHeight === "30px" : true,
      legacyBodyColor: kind === "course" ? true : data.bodyColor === "rgb(66, 66, 66)",
      legacyReadableTextSize: kind === "course" ? true : data.bodyFontSize === expectedReadableTextFontSize,
      legacyReadableLineHeight: kind === "course" ? true : readableTextLineHeight >= expectedReadableTextLineHeight,
      legacyHeadingBlue: kind === "course" ? true : data.h1Color === "rgb(44, 150, 255)",
      legacyHeadingMono: kind === "course" ? true : String(data.h1FontFamily || "").includes("PT Mono"),
      legacyHeadingSize: kind === "course" ? true : data.h1FontSize === "32px" && Number.parseFloat(data.h1LineHeight || "0") >= 39,
      legacySubheadingYellow: kind === "course" ? true : !data.h2Color || data.h2Color === "rgb(254, 182, 0)",
      legacyTableReadable: kind === "course" ? true : !data.hasTableCell || (data.tableCellFontSize === expectedTableFontSize && tableLineHeight >= expectedTableLineHeight),
      exerciseTitleMono: kind === "course" ? true : !data.hasExerciseTitle || (String(data.exerciseTitleFontFamily || "").includes("PT Mono") && data.exerciseTitleFontSize === "20px"),
      noHorizontalCollapse: !data.contentRect || data.contentRect.width > 260,
    };
    results.push({ kind, viewportName, url, title, screenshot, data, assertions, ok: Object.values(assertions).every(Boolean) });
  }

  try {
    if (selfTest) {
      const page = await browser.newPage({ viewport: viewports[1] });
      await page.setContent(`<!doctype html>
        <html>
          <head>
            <title>Seven Visual QA Self Test</title>
            <style>
              .seven-page { max-width: 960px; margin: 0 auto; }
              .lesson__content--seven { color: rgb(66, 66, 66); font-size: 16px; line-height: 30px; font-family: Arial, sans-serif; }
              .lesson__content h1 { color: rgb(44, 150, 255); font-family: "PT Mono", monospace; font-size: 32px; line-height: 1.25; }
              .lesson__content h2 { color: rgb(254, 182, 0); font-family: "PT Mono", monospace; font-size: 26px; }
              .lesson__content table td { font-size: 16px; line-height: 20px; }
              .exercises__title { font-family: "PT Mono", monospace; font-size: 20px; }
            </style>
          </head>
          <body>
            <main class="seven-page">
              <article class="lesson__content lesson__content--seven">
                <h1>Seven visual QA self test</h1>
                <h2>Legacy subheading</h2>
                <p>${"Readable lesson text. ".repeat(40)}</p>
                <table><tbody><tr><td>Readable table text</td></tr></tbody></table>
                <section class="seven-exercises"><h3 class="exercises__title">Exercise title</h3></section>
              </article>
            </main>
          </body>
        </html>`, { waitUntil: "domcontentloaded" });
      const screenshot = path.join(screenshotDir, "self-test-mobile.png");
      await page.screenshot({ path: screenshot, fullPage: false });
      const data = await page.evaluate(() => {
        const lessonContent = document.querySelector(".lesson__content--seven");
        const h1 = document.querySelector(".lesson__content h1");
        const h2 = document.querySelector(".lesson__content h2");
        const tableCell = document.querySelector(".lesson__content table td");
        const exerciseTitle = document.querySelector(".exercises__title");
        const contentStyle = getComputedStyle(lessonContent);
        const h1Style = getComputedStyle(h1);
        const h2Style = getComputedStyle(h2);
        const tableCellStyle = getComputedStyle(tableCell);
        const exerciseTitleStyle = getComputedStyle(exerciseTitle);
        return {
          hasSevenPage: Boolean(document.querySelector(".seven-page")),
          hasLessonContent: Boolean(lessonContent),
          bodyTextLength: document.body.innerText.length,
          bodyColor: contentStyle.color,
          bodyFontSize: contentStyle.fontSize,
          bodyLineHeight: contentStyle.lineHeight,
          h1Color: h1Style.color,
          h1FontFamily: h1Style.fontFamily,
          h1FontSize: h1Style.fontSize,
          h1LineHeight: h1Style.lineHeight,
          h2Color: h2Style.color,
          tableCellFontSize: tableCellStyle.fontSize,
          tableCellLineHeight: tableCellStyle.lineHeight,
          exerciseTitleFontFamily: exerciseTitleStyle.fontFamily,
          exerciseTitleFontSize: exerciseTitleStyle.fontSize,
          contentRect: lessonContent.getBoundingClientRect().toJSON(),
        };
      });
      const assertions = {
        playwrightLaunches: true,
        systemChromeAvailable: Boolean(executablePath),
        notBlank: data.bodyTextLength > 500,
        sevenPagePresent: data.hasSevenPage === true,
        lessonContentPresent: data.hasLessonContent === true,
        legacyBodyColor: data.bodyColor === "rgb(66, 66, 66)",
        legacyReadableTextSize: data.bodyFontSize === "16px",
        legacyReadableLineHeight: data.bodyLineHeight === "30px",
        legacyHeadingBlue: data.h1Color === "rgb(44, 150, 255)",
        legacyHeadingMono: String(data.h1FontFamily || "").includes("PT Mono"),
        legacyHeadingSize: data.h1FontSize === "32px" && Number.parseFloat(data.h1LineHeight || "0") >= 39,
        legacySubheadingYellow: data.h2Color === "rgb(254, 182, 0)",
        legacyTableReadable: data.tableCellFontSize === "16px" && Number.parseFloat(data.tableCellLineHeight || "0") >= 19,
        exerciseTitleMono: String(data.exerciseTitleFontFamily || "").includes("PT Mono") && data.exerciseTitleFontSize === "20px",
        noHorizontalCollapse: data.contentRect.width > 260,
      };
      results.push({ kind: "self-test", viewportName: "mobile", url: "about:blank", title: await page.title(), screenshot, data, assertions, ok: Object.values(assertions).every(Boolean) });
      await page.close();
    } else {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      page.on("console", (msg) => {
        if (["error", "warning"].includes(msg.type())) {
          consoleEntries.push({ type: msg.type(), text: msg.text(), url: page.url(), viewport: viewport.name });
        }
      });
      await checkPage(page, courseUrl, viewport.name, "course");
      await checkPage(page, lessonUrl, viewport.name, "lesson");
      await page.close();
    }
    }
  } finally {
    await browser.close();
  }

  const relevantConsole = consoleEntries.filter((entry) => !/favicon|404/.test(entry.text));
  const report = {
    generatedAt: new Date().toISOString(),
    writes: false,
    baseUrl,
    languageCode,
    lessonOrder,
    browser: "playwright-chromium",
    playwrightModule: playwrightModuleName,
    executablePath,
    selfTest,
    screenshots: results.map((item) => item.screenshot),
    results,
    consoleEntries,
    assertions: {
      pagesOk: results.every((item) => item.ok),
      consoleHealthy: relevantConsole.length === 0,
      desktopAndMobileCovered: selfTest ? true : new Set(results.map((item) => item.viewportName)).size === 2,
      courseAndLessonCovered: selfTest ? true : new Set(results.map((item) => item.kind)).size === 2,
      selfTestOk: selfTest ? results.every((item) => item.ok) : true,
    },
  };
  report.ok = Object.values(report.assertions).every(Boolean);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  const reportPath = arg("json-report", "/tmp/speakasap-seven-postdeploy-visual-qa-v1.json");
  const report = {
    generatedAt: new Date().toISOString(),
    writes: false,
    ok: false,
    error: String(error && error.stack ? error.stack : error),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.exit(1);
});
