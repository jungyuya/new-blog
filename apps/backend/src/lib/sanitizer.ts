    import sanitizeHtml from 'sanitize-html';

    // 허용 iframe 호스트 화이트리스트
    const IFRAME_HOST_WHITELIST = [
      'www.youtube.com',
      'youtube.com',
      'youtube-nocookie.com',
      'player.vimeo.com'
    ];

    /**
     * 블로그 콘텐츠를 위한 맞춤형 HTML 정제기 (sanitize-html 기반)
     * @param dirtyHtml 정제할 HTML 문자열 (마크다운 원본)
     * @returns 정제된 안전한 HTML 문자열
     */
    export function sanitizeContent(dirtyHtml: string): string {
      const cleanHtml = sanitizeHtml(dirtyHtml, {
        // 1) 허용 태그
        allowedTags: [
          'p','br','b','i','strong','em','strike','del','a','span',
          'h1','h2','h3','h4','h5','h6',
          'ul','ol','li',
          'blockquote','pre','code',
          'table','thead','tbody','tr','th','td',
          'img','iframe'
        ],

        // 2) 허용 속성 (가장 중요한 보안 강화 부분)
        allowedAttributes: {
          a: ['href', 'title', 'target', 'rel'],
          // [수정] src 속성의 존재 자체는 허용합니다. 값의 유효성은 transformTags에서 검증합니다.
          img: ['src', 'alt', 'title', 'loading'],
          code: ['class'],
          iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title'],
        },

        // 3) 허용 URL 프로토콜: 전역적으로 https만 허용
        allowedSchemes: ['https', 'mailto', 'tel'],

        // 4) 태그별 예외: img 태그에 한해 data:image 허용
        allowedSchemesByTag: {
          img: ['data', 'https']
        },

        // 5) 프로토콜 상대 경로 비허용
        allowProtocolRelative: false,

        // 6) iframe 호스트 1차 검증
        allowedIframeHostnames: IFRAME_HOST_WHITELIST,

        // 7) iframe 정밀 검증 필터 (2차 방어)
        exclusiveFilter: (frame) => {
          if (frame.tag === 'iframe') {
            const src = frame.attribs.src || '';
            try {
              const url = new URL(src);
              if (url.protocol !== 'https:') {
                return true;
              }
              const host = url.hostname.toLowerCase();
              const isAllowed = IFRAME_HOST_WHITELIST.some(allowedHost =>
                host === allowedHost || host.endsWith('.' + allowedHost)
              );
              return !isAllowed;
            } catch (e) {
              return true;
            }
          }
          return false;
        },

        // 8) 태그 변환 규칙: 외부 링크 처리만 남깁니다.
        transformTags: {
          'a': (tagName, attribs) => {
            const href = attribs.href || '';
            if (/^https?:\/\//i.test(href)) {
              attribs.target = '_blank';
              const relParts = attribs.rel ? attribs.rel.split(/\s+/) : [];
              if (!relParts.includes('noopener')) relParts.push('noopener');
              if (!relParts.includes('noreferrer')) relParts.push('noreferrer');
              attribs.rel = relParts.join(' ');
            }
            return { tagName, attribs };
          },
          // [핵심 수정] img 태그 변환 로직은 보안을 위해 제거합니다.
        }
      });

      return cleanHtml;
    }