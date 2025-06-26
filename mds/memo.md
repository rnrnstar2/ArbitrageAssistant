【タスク作成プロンプト】
MVPシステム設計.mdをしっかり理解してから実装を開始すること。
claude codeで実行するための最適なタスク分けをすること。
claude codeでそれぞれ独立して実行可能なものにすること。
ultrathink

【タスク実行プロンプト】
MVPシステム設計.mdをしっかり理解してから実装を開始すること。
[hedge systemのbuildを実行して。成功しない場合はエラーを修正して。]
ultrathink

【エラー修正プロンプト】
MVPシステム設計.mdをしっかり理解してからエラー修正を開始すること。
hedge systemのUIを修正したい。
表示は接続中の口座情報だけでいい。ポジションも表示。
ultrathink

<!-- .haconiwa/README.md
このガイドをしっかり理解してから開始すること。
特にこの部分 -> ### CRD-Based Architecture -->

<!-- 現在haconiwaが開発中でceoがそれぞれのペインの状況を確認したりできないということは理解している。そのため開発を進めるには私のサポートが必要だと思います。なので私の必要なサポート内容についてもこちらにまとめている。必要があれば更新して。
tasks/user-ceo-responsibilities.md -->

haconiwaのベストプラクティスのCRD設計で、MVPシステム設計.mdの実装を進めるのに最適な6x3 Grid構成のwindow, paneを設計したい。
今はhaconiwaは開発段階なので自分でscriptファイルを作成して実装している。

npm run haconiwa:startでワークスペースを開いて、それぞれのペインで作業できる。
それぞれのペインで開かれているclaude codeが自分自身の役割を理解するための実装。
環境変数を設定した上で、claudeを立ち上げるようにした。
立ち上がったそれぞれのclaudeに指示出しをするとき、環境変数を読み込ませて役割を把握させる必要がある。

私はCEO（ceo-main）に毎回固定の指示を出すようにしている。
環境変数を使ってarbitrage-assistant.yamlから、ceo-mainとしての役割を確認。
MVPシステム設計.mdと現在のプロジェクト実装状況チェック。
ceo(director-coordinator), ceo(progress-monitor)のペインで開かれているclaude codeのinput欄にtmuxコマンドで指示を入力。指示の最後に必ず「ultrathink」をつけておく。

これらの内容をceoから別windowのそれぞれの該当するペインに指示出しをするときも同じようにする必要がある。CRDの組織の命令系統全てで指示を出すときはこのようなプロンプトが必要。

現在部屋が18作成されるが、その中でcluade起動しているものとしていないものがある。これはどうしてそのようになる？
.tmux.confのbase-indexを0にしてそれに合わせて変更してほしい。

ultrathink

---

agent idが設定されていないペインがある。exec-04というエージェント名になっている。
ペインのclaude codeのinput欄に[claude --dangerously-skip-permissions]というテキストが入力された状態でスタートしているものがある。
これはclaudeを開いた後にその入力を行っているからだと思う。チェックして。

ultrathink

echo $HACONIWA_AGENT_ID
