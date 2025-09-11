import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';

// 허용 iframe 호스트 화이트리스트 (기존과 동일)
const IFRAME_HOST_WHITELIST = [
  'www.youtube.com',
  'youtube.com',
  'youtube-nocookie.com',
  'player.vimeo.com'
];

/**
 * [최종 수정] 블로그 콘텐츠(마크다운)를 안전한 HTML로 변환하고 정제합니다.
 * 코드 블록 파싱 오류를 원천적으로 차단하기 위해 'Placeholder' 전략을 사용합니다.
 * @param markdownContent 정제할 마크다운 원본 문자열
 * @returns 정제된 안전한 HTML 문자열을 담은 Promise
 */
export async function sanitizeContent(markdownContent: string): Promise<string> {
  // 1단계: 마크다운을 HTML로 변환합니다.
  const convertedHtml = await marked.parse(markdownContent);

  // --- [핵심 로직] Placeholder 전략 시작 ---

  // 2단계: 원본 코드 블록을 저장할 배열과 자리표시자를 만듭니다.
  const codeBlocks: string[] = [];
  const placeholder = (i: number) => `__CODE_BLOCK_PLACEHOLDER_${i}__`;

  // 3단계: <pre><code>...</code></pre> 패턴을 찾아 자리표시자로 '치환'하고,
  // 원본 내용은 codeBlocks 배열에 '숨겨둡니다'.
  const htmlWithPlaceholders = convertedHtml.replace(
    /<pre><code class="language-(.*?)">([\s\S]*?)<\/code><\/pre>/g,
    (match, lang, code) => {
      const index = codeBlocks.length;
      codeBlocks.push(match); // pre, code 태그를 포함한 전체를 저장
      return placeholder(index);
    }
  );

  // 4단계: 이제 코드 블록이 완전히 제거된 안전한 HTML을 정제합니다.
  // sanitize-html은 더 이상 문제를 일으킬 코드를 볼 수 없습니다.
  const sanitizedHtml = sanitizeHtml(htmlWithPlaceholders, {
    // parser 옵션은 더 이상 불필요하므로 제거해도 괜찮습니다.
    // 하지만 만약을 위해 남겨두는 것도 안전합니다.
    parser: {
      decodeEntities: false,
    },
    // 나머지 모든 옵션은 기존과 동일합니다.
    allowedTags: [
      'p','br','b','i','strong','em','strike','del','a','span',
      'h1','h2','h3','h4','h5','h6',
      'ul','ol','li','blockquote',
      // 'pre', 'code' 태그는 자리표시자로 처리되므로 여기서 허용할 필요가 없지만,
      // 만약의 경우를 대비해 남겨두는 것이 더 안전합니다.
      'pre', 'code',
      'table','thead','tbody','tr','th','td',
      'img','iframe'
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'loading'],
      code: ['class'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title'],
    },
    allowedSchemes: ['https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['data', 'https'] },
    allowProtocolRelative: false,
    allowedIframeHostnames: IFRAME_HOST_WHITELIST,
    exclusiveFilter: (frame) => {
      if (frame.tag === 'iframe') {
        const src = frame.attribs.src || '';
        try {
          const url = new URL(src);
          if (url.protocol !== 'https:') return true;
          const host = url.hostname.toLowerCase();
          const isAllowed = IFRAME_HOST_WHITELIST.some(allowedHost =>
            host === allowedHost || host.endsWith('.' + allowedHost)
          );
          return !isAllowed;
        } catch (e) { return true; }
      }
      return false;
    },
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
    }
  });

  // 5단계: 정제가 끝난 HTML의 자리표시자를 숨겨두었던 원본 코드 블록으로 '복원'합니다.
  let finalHtml = sanitizedHtml;
  codeBlocks.forEach((block, index) => {
    finalHtml = finalHtml.replace(placeholder(index), block);
  });

  // --- Placeholder 전략 종료 ---

  return finalHtml;
}