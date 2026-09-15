import AppKit
import WebKit
import UniformTypeIdentifiers

// A local, persistent WebKit window. The repository remains the source of truth.
@MainActor
final class StudioApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var root = ""
    var node = ""
    var server: Process?
    var didStartServer = false
    var isClosing = false
    let address = URL(string: "http://127.0.0.1:4323/")!

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let configURL = Bundle.main.url(forResource: "LocalConfig", withExtension: "plist"),
              let config = NSDictionary(contentsOf: configURL),
              let repository = config["Repository"] as? String,
              let executable = config["Node"] as? String else {
            fail("アプリの設定を読み込めませんでした。リポジトリで pnpm run editor:news:install を実行してください。")
            return
        }
        root = repository
        node = executable
        makeMenu()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 840), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "News Studio"
        window.minSize = NSSize(width: 820, height: 600)
        window.contentView = webView
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.setFrameAutosaveName("NewsStudioMain")
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        webView.loadHTMLString("<html><body style='background:white;color:black;font:16px -apple-system;display:grid;place-items:center;height:90vh'><div><h1 style='color:#05429a'>News Studio</h1><p>編集ツールを起動しています…</p></div></body></html>", baseURL: nil)
        connect(attempt: 0)
    }

    func makeMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "News Studioについて", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "News Studioを隠す", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "News Studioを終了", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let file = NSMenuItem()
        let fileMenu = NSMenu(title: "ファイル")
        let save = fileMenu.addItem(withTitle: "記事を保存", action: #selector(saveArticle), keyEquivalent: "s")
        save.target = self
        fileMenu.addItem(withTitle: "ウィンドウを閉じる", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        file.submenu = fileMenu
        menu.addItem(file)
        let edit = NSMenuItem()
        let editMenu = NSMenu(title: "編集")
        for (title, selector, key) in [("元に戻す", "undo:", "z"), ("切り取り", "cut:", "x"), ("コピー", "copy:", "c"), ("ペースト", "paste:", "v"), ("すべて選択", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        edit.submenu = editMenu
        menu.addItem(edit)
        NSApp.mainMenu = menu
    }

    @objc func saveArticle() {
        webView.evaluateJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', {key:'s', metaKey:true, bubbles:true}))", completionHandler: nil)
    }

    func connect(attempt: Int) {
        var request = URLRequest(url: address.appendingPathComponent("api/health"))
        request.timeoutInterval = 2
        URLSession.shared.dataTask(with: request) { data, response, _ in
            DispatchQueue.main.async {
                if let response = response as? HTTPURLResponse {
                    guard response.statusCode == 200,
                          let data = data,
                          let json = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                          json["app"] == "noguchy-news-studio", json["root"] == self.root else {
                        self.fail("ポート4323で別のツール、または古いエディタが起動しています。そのツールを終了してからNews Studioを開き直してください。")
                        return
                    }
                    self.webView.load(URLRequest(url: self.address))
                    return
                }
                if !self.didStartServer {
                    self.didStartServer = true
                    do { try self.startServer() } catch {
                        self.fail("編集ツールを起動できませんでした。\n\(error.localizedDescription)")
                        return
                    }
                }
                guard attempt < 40 else {
                    self.fail("起動に時間がかかっています。\(self.root)/.local/news-editor/app-server.log を確認してください。")
                    return
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.connect(attempt: attempt + 1) }
            }
        }.resume()
    }

    func startServer() throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: node)
        process.arguments = ["scripts/news-editor-server.mjs"]
        process.currentDirectoryURL = URL(fileURLWithPath: root)
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = URL(fileURLWithPath: node).deletingLastPathComponent().path + ":/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        environment["NEWS_EDITOR_PORT"] = "4323"
        process.environment = environment
        let folder = URL(fileURLWithPath: root).appendingPathComponent(".local/news-editor")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let log = folder.appendingPathComponent("app-server.log")
        if !FileManager.default.fileExists(atPath: log.path) { FileManager.default.createFile(atPath: log.path, contents: nil) }
        let handle = try FileHandle(forWritingTo: log)
        handle.seekToEndOfFile()
        process.standardOutput = handle
        process.standardError = handle
        process.standardInput = FileHandle.nullDevice
        try process.run()
        try? handle.close()
        server = process
        // Leave this loopback-only server running for other editor windows.
    }

    func fail(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "News Studioを開けませんでした"
        alert.informativeText = message
        alert.addButton(withTitle: "閉じる")
        alert.runModal()
        NSApp.terminate(nil)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window?.makeKeyAndOrderFront(nil)
        return true
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if isClosing { isClosing = false; return true }
        webView.evaluateJavaScript("window.dispatchEvent(new Event('pagehide'))") { _, _ in
            self.isClosing = true
            sender.performClose(nil)
        }
        return false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let webView = webView else { return .terminateNow }
        webView.evaluateJavaScript("window.dispatchEvent(new Event('pagehide'))") { _, _ in sender.reply(toApplicationShouldTerminate: true) }
        return .terminateLater
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.allowedContentTypes = [.image]
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "News Studio"
        alert.informativeText = message
        alert.addButton(withTitle: "続ける")
        alert.addButton(withTitle: "キャンセル")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload { decisionHandler(.download); return }
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "about" || (url.host == "127.0.0.1" && url.port == 4323) {
            decisionHandler(.allow)
        } else {
            if ["https", "http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.url : nil) }
    }
}

MainActor.assumeIsolated {
    let app = NSApplication.shared
    app.setActivationPolicy(.regular)
    let delegate = StudioApp()
    app.delegate = delegate
    withExtendedLifetime(delegate) { app.run() }
}
