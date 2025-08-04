OPENAI_API_KEY=""

$(document).ready(function() {
    
    // ページ総数
    const totalPages = 3;

    // 決定ボタンのクリックイベント
    $('#startButton').click(async function() {
        // すべての入力項目からテキストを取得
        // 変更されたHTMLのinput IDに合わせて、ユーザー入力の取得を更新
        OPENAI_API_KEY=$('#apikey').val().trim(); 
        const itemName = $('#Itemname').val().trim(); // 項目1: 製品のカテゴリー
        const nickname = $('#nickname').val().trim(); // 項目2: お子様のあだ名
        const gender = $('#genderSelect').val();      // 項目3: 性別
        const age = $('#ageSelect').val();            // 項目4: 年齢
        const frequency = $('#frequencySelect').val(); // 項目5: 使った頻度
        const encounterText = $('#encount-text').val().trim(); // 項目6: どのような出逢い方をしましたか？
        const relText = $('#rel-text').val().trim();  // 項目7: 自由記入

        // 必須項目チェック (必要であればコメント解除して利用)
        /*
        if (itemName === '' || nickname === '' || gender === '' || age === '' || frequency === '' || encounterText === '' || relText === '') {
            alert('すべての項目を入力してください。');
            return;
        }
        */

        // ユーザー入力をオブジェクトにまとめる
        const userInputs = {
            itemName: itemName,
            nickname: nickname,
            gender: gender,
            age: age,
            frequency: frequency,
            encounterText: encounterText,
            freeFormText: relText
        };

        // 初期画面を非表示にし、フリップブック画面を表示
        $('#welcome-screen').addClass('hidden');
        $('#loading-screen').removeClass('hidden'); // 新しく追加するローディング画面
        try{
        const storyData = await generateBookPageText(userInputs, totalPages);

            // フリップブックのページを動的に生成
        $('#flipbook').empty(); // 既存のページをクリア
        if (storyData && Array.isArray(storyData.pages)) {
                for (const page of storyData.pages) {
                    const imagePrompt = `A illustration depicting ${page.illustration_description}. Style should be whimsical and colorful, suitable for young children.`;
                    const imageUrl = await generateImage(imagePrompt);

                    const pageHtml = `
                        <div class="turn-page">
                            ${imageUrl ? `<img src="${imageUrl}" alt="挿絵 ${page.page_number}">` : '<div class="placeholder-image"></div>'}
                            <p class="user-text">${page.page_text}</p>
                        </div>
                    `;
                    $('#flipbook').append(pageHtml);
                }
        } else {
            // pages配列が見つからない、または不正な場合のハンドリング
            throw new Error("OpenAIからの物語データが不正な形式です。'pages'配列が見つかりません。");
        }

        $('#loading-screen').addClass('hidden');
        $('#flipbook-screen').removeClass('hidden');
        // turn.jsを初期化
        $('#flipbook').turn({
            width: $('#flipbook-screen').width()*0.9 ,
            height: $('#flipbook-screen').height()*0.9 ,
            autoCenter: false,
            display: 'single', // 1ページ表示に設定
            gradients: true,
            acceleration: true,
            pages: totalPages,
            duration: 800,
        });
        
        // ページが表示された後にサイズを取得して表示
        $('#flipbook').bind('turned', function(event, page, view) {
            const pageWidth = $('.turn-page').width();
            const pageHeight = $('.turn-page').height();
            $('.page-size').text(`${pageWidth}px x ${pageHeight}px`);
        });

        // 初回表示時にもサイズを表示
        const pageWidth = $('.turn-page').width();
        const pageHeight = $('.turn-page').height();
        $('.page-size').text(`${pageWidth}px x ${pageHeight}px`);
        }catch (error) {
            console.error('絵本の生成中にエラーが発生しました:', error);
            alert(`絵本の生成に失敗しました。もう一度お試しください。${error}`);
            // エラー時は初期画面に戻すなど、適切なエラーハンドリングを行う
            $('#loading-screen').addClass('hidden');
            $('#welcome-screen').removeClass('hidden');
        }

        // LLMに絵本のページを書いてもらう擬似API
        async function generateBookPageText(inputs, pageNum) {
            console.log(`OpenAI API: ページ ${pageNum} のテキストを生成中...`);

            // プロンプトの構築
            // pageNumは物語全体のプロンプトを作成するために使用せず、
            // 取得したJSONデータから各ページのテキストを抽出するために使用する想定
            const prompt = createStoryPrompt(inputs,pageNum);

            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o", // または利用可能な最新のモデル (例: gpt-4o-mini, gpt-4)
                        messages: [{
                            role: "user",
                            content: prompt
                        }],
                        response_format: { type: "json_object" } // JSON形式での出力を指定
                    })
                });

                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({})); // エラーボディを解析、失敗しても続行
                    const errorText = errorBody.error ? errorBody.error.message : response.statusText;
                    const customError = new Error(`APIリクエストが失敗しました: ${errorText}`);
                    customError.status = response.status;
                    customError.statusText = response.statusText;
                    customError.body = errorBody; // 詳細情報を含める
                    throw customError;
                }

                const data = await response.json();
                console.log(`OpenAI Rawレスポンス:`, data);

                // 成功レスポンスのチェック
                if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                    return JSON.parse(data.choices[0].message.content);
                } else {
                    throw new Error("OpenAIからのレスポンス形式が不正です。");
                }

            } catch (error) {
                console.error(`OpenAI API呼び出し中にエラーが発生しました:`, error);
                throw error; // エラーを上位のcatchブロックに伝播
            }
        }
        function createStoryPrompt(inputs,totalpages) {
            // ユーザー入力に基づいて物語のテーマを構築
            const itemName = inputs.itemName || '不思議なアイテム';
            const mainCharacter = inputs.nickname || 'ちいさな冒険者';
            const characterGender = inputs.gender === '男性' ? '男の子' : (inputs.gender === '女性' ? '女の子' : '子ども');
            const characterAge = inputs.age !== '' ? `${inputs.age}歳` : '幼い';
            const frequency = inputs.frequency || '時々';
            const encounterStory = inputs.encounterText || 'ある日突然、目の前に現れた';
            const freeFormText = inputs.freeFormText || '特別な絆で結ばれている';

            const prompt = `
        あなたは、子ども向けのファンタジー絵本の物語作家です。ユーザーから提供された情報に基づいて、魔法と冒険に満ちた3ページの物語を創作してください。物語は実話ではなく、完全にフィクションのファンタジーです。

        ## 制約事項
        - 出力はJSON形式であること。JSONのルート要素は"pages"というキーを持つ配列で、各配列要素は以下のキーを持つオブジェクトとすること。
            - **"page_number"**: 物語のページ番号 (1から始まる整数)。
            - **"page_text"**: そのページの物語のテキスト (500文字以下)。
            - **"illustration_description"**: そのページに描かれる挿絵の具体的な内容を示す英語の短い説明 (例: "A unicorn standing in a magical forest")。この説明は、将来的に画像生成AIへの指示として使われます。また登場するキャラクターの特徴を同一のワードで含めること。
        - 物語は合計で${totalpages}ページであること。
        - 各ページの物語の文字数は100文字以下とすること。
        - 各ページには、物語のテキストと、そのページに合う挿絵を描くための簡単な説明を含めること。
        - ユーザーの入力情報をファンタジーの要素として物語に織り交ぜること。

        ## ユーザー入力情報
        - 製品のカテゴリー: ${itemName}
        - 主人公の名前: ${mainCharacter}
        - 主人公の性別: ${characterGender}
        - 主人公の年齢: ${characterAge}
        - 使った頻度: ${frequency}
        - 重要なアイテムとの出会い: ${encounterStory}
        - 自由記入: ${freeFormText}

        ## 物語のテーマ
        ${mainCharacter}が、${itemName}という特別なアイテムと${encounterStory}を通じて出会い、${frequency}のように繰り返し使う中で、${freeFormText}という絆を深めながら繰り広げる、心温まる冒険と成長の物語。

        ## 出力例 (JSON形式)
        \`\`\`json
        {
        "pages": [
            {
            "page_number": 1,
            "page_text": "むかしむかし、きらめく星の谷に、${mainCharacter}という${characterAge}の${characterGender}が住んでいました。ある日、${itemName}と名付けられた不思議な輝きを持つものが、${encounterStory}。",
            "illustration_description": "${mainCharacter}は黒髪の男の子。星の谷で輝く${itemName}を見つめる${mainCharacter}"
            },
            {
            "page_number": 2,
            "page_text": "その${itemName}は、触れると温かい光を放ち、${mainCharacter}を未知の世界へと導きました。彼は${frequency}、${itemName}と共に空を飛び、森を駆け巡り、たくさんの魔法を学びました。",
            "illustration_description": "${mainCharacter}は黒髪の男の子。光る${itemName}を手に、空を飛ぶ${mainCharacter}"
            },
            {
            "page_number": 3,
            "page_text": "新しい友と出会い、数々の困難を乗り越え、${mainCharacter}は大きく成長しました。${itemName}との間には、${freeFormText}という特別な絆が生まれ、二人はこれからもたくさんの素敵な物語を紡いでいくでしょう。",
            "illustration_description": "${mainCharacter}は黒髪の男の子。成長した${mainCharacter}が、${itemName}と共に夕日を眺めている"
            }
        ]
        }
        \`\`\`
        物語のJSONのみを出力してください。
        `;
            return prompt;
        }
    });

        // 画像生成関数
    async function generateImage(prompt) {
        console.log(`OpenAI API: 画像生成中... プロンプト: ${prompt}`);
        try {
            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "dall-e-3", // または利用可能な画像生成モデル
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024", // 必要に応じてサイズを調整
                    response_format: "b64_json"
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const errorText = errorBody.error ? errorBody.error.message : response.statusText;
                throw new Error(`画像生成APIリクエストが失敗しました: ${errorText}`);
            }

            const data = await response.json();
            if (data.data && data.data.length > 0 && data.data[0].b64_json) {
                return `data:image/png;base64,${data.data[0].b64_json}`;
            } else {
                return "a";
            }
        } catch (error) {
            console.error("画像生成中にエラーが発生しました:", error);
            return error;
        }
    }

    // キーボードの矢印キーでページをめくる
    $(document).keydown(function(e) {
        if ($('#flipbook-screen').is(':visible')) {
            const previous = 37, next = 39;
            switch (e.keyCode) {
                case previous:
                    $('#flipbook').turn('previous');
                    break;
                case next:
                    $('#flipbook').turn('next');
                    break;
            }
        }
    });
});
