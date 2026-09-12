import { test, expect } from '@playwright/test'

// ── 정적 페이지 ─────────────────────────────────────────────────────────────

test.describe('정적 페이지 로드', () => {
  test('홈페이지', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/최애의 관리자|SAIGO/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('수감자 목록', async ({ page }) => {
    await page.goto('/sinners')
    await expect(page).toHaveTitle(/수감자|최애의 관리자/i)
    // 12 수감자 카드가 렌더링되는지
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('덱 게시판', async ({ page }) => {
    await page.goto('/decks')
    await expect(page).toHaveTitle(/덱|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('덱 빌더', async ({ page }) => {
    await page.goto('/decks/new')
    await expect(page).toHaveTitle(/덱|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('거울 던전', async ({ page }) => {
    await page.goto('/mirror-dungeon')
    await expect(page).toHaveTitle(/거울|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('메타 분석', async ({ page }) => {
    await page.goto('/meta')
    await expect(page).toHaveTitle(/분석|메타|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('보유 현황', async ({ page }) => {
    await page.goto('/collection')
    await expect(page).toHaveTitle(/보유|컬렉션|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })



  test('공지사항', async ({ page }) => {
    await page.goto('/announcements')
    await expect(page).toHaveTitle(/공지|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('로그인 페이지', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/로그인|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('개인정보처리방침', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).toHaveTitle(/개인정보|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('이용약관', async ({ page }) => {
    await page.goto('/terms')
    await expect(page).toHaveTitle(/이용약관|최애의 관리자/i)
    await expect(page.locator('#main-content')).toBeVisible()
  })
})

// ── 네비게이션 ──────────────────────────────────────────────────────────────

test.describe('네비게이션', () => {
  test('로고 클릭 시 홈으로 이동', async ({ page }) => {
    await page.goto('/sinners')
    await page.locator('nav a[href="/"]').first().click()
    await expect(page).toHaveURL('/')
  })

  test('수감자 페이지 링크', async ({ page }) => {
    await page.goto('/')
    // 데스크탑 드롭다운으로 네비게이션
    const dbButton = page.locator('nav button', { hasText: 'DB' })
    if (await dbButton.isVisible()) {
      await dbButton.hover()
      await page.locator('nav a[href="/sinners"]').first().click()
      await expect(page).toHaveURL('/sinners')
    }
  })

  test('검색 모달 Ctrl+K', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Control+k')
    // 검색 모달이 열리는지 확인
    await expect(page.locator('input[placeholder]').first()).toBeVisible({ timeout: 3000 })
  })
})

// ── 접근성 ──────────────────────────────────────────────────────────────────

test.describe('접근성', () => {
  test('skip navigation 링크 존재', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
    // 포커스하면 보이는지
    await skipLink.focus()
    await expect(skipLink).toBeVisible()
  })

  test('main content에 id 존재', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main#main-content')).toBeVisible()
  })

  test('nav에 aria-label 존재', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav[aria-label="메인 내비게이션"]')).toBeVisible()
  })

  test('이미지에 alt 속성 존재', async ({ page }) => {
    await page.goto('/')
    const images = page.locator('img')
    const count = await images.count()
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt')
      expect(alt).not.toBeNull()
    }
  })

  test('모바일 햄버거 버튼에 aria-label 존재', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const menuBtn = page.locator('button[aria-label="메뉴 열기"]')
    await expect(menuBtn).toBeVisible()
  })
})

// ── SEO ─────────────────────────────────────────────────────────────────────

test.describe('SEO', () => {
  test('JSON-LD 구조화 데이터 존재', async ({ page }) => {
    await page.goto('/')
    const scripts = page.locator('script[type="application/ld+json"]')
    const count = await scripts.count()
    expect(count).toBeGreaterThanOrEqual(2) // WebSite + Organization

    for (let i = 0; i < count; i++) {
      const content = await scripts.nth(i).textContent()
      expect(content).toBeTruthy()
      const json = JSON.parse(content!)
      expect(json['@context']).toBe('https://schema.org')
    }
  })

  test('meta description 존재', async ({ page }) => {
    await page.goto('/')
    const desc = page.locator('meta[name="description"]')
    await expect(desc).toHaveAttribute('content', /Limbus/)
  })

  test('canonical URL 존재', async ({ page }) => {
    await page.goto('/')
    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toBeAttached()
  })

  test('Open Graph 메타 태그 존재', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('meta[property="og:title"]')).toBeAttached()
    await expect(page.locator('meta[property="og:description"]')).toBeAttached()
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
  })

  test('manifest 링크 존재', async ({ page }) => {
    await page.goto('/')
    const manifest = page.locator('link[rel="manifest"]')
    await expect(manifest).toBeAttached()
  })

  test('apple-mobile-web-app 메타 태그 존재', async ({ page }) => {
    await page.goto('/')
    const meta = page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')
    await expect(meta).toBeAttached()
  })
})

// ── 반응형 ──────────────────────────────────────────────────────────────────

test.describe('반응형', () => {
  test('모바일 뷰포트에서 햄버거 메뉴 표시', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    // 햄버거 버튼 보임
    await expect(page.locator('button[aria-label="메뉴 열기"]')).toBeVisible()
    // 데스크탑 메뉴 숨김
    await expect(page.locator('nav .hidden.md\\:flex')).not.toBeVisible()
  })

  test('데스크탑 뷰포트에서 네비게이션 바 표시', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    // 데스크탑 메뉴 보임
    await expect(page.locator('nav .hidden.md\\:flex')).toBeVisible()
  })

  test('모바일 메뉴 열기/닫기', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    // 메뉴 열기
    await page.locator('button[aria-label="메뉴 열기"]').click()
    await expect(page.locator('button[aria-label="메뉴 닫기"]')).toBeVisible()
    // 메뉴 닫기
    await page.locator('button[aria-label="메뉴 닫기"]').click()
    await expect(page.locator('button[aria-label="메뉴 열기"]')).toBeVisible()
  })
})

// ── 페이지별 콘텐츠 검증 ─────────────────────────────────────────────────────

test.describe('페이지 콘텐츠', () => {
  test('홈 — 히어로 섹션 렌더링', async ({ page }) => {
    await page.goto('/')
    // 메인 콘텐츠가 비어있지 않은지
    const mainContent = await page.locator('#main-content').textContent()
    expect(mainContent?.length).toBeGreaterThan(0)
  })

  test('수감자 — 수감자 카드 렌더링', async ({ page }) => {
    await page.goto('/sinners')
    // 수감자 이름이 하나 이상 보이는지
    await page.waitForTimeout(2000)
    const content = await page.locator('#main-content').textContent()
    expect(content).toMatch(/이상|파우스트|돈키호테|료슈|뫼르소|홍루|히스클리프|이스마엘|로쟈|싱클레어|오티스|그레고르/)
  })

  test('거울 던전 — EGO 기프트 렌더링', async ({ page }) => {
    await page.goto('/mirror-dungeon')
    await page.waitForTimeout(2000)
    const content = await page.locator('#main-content').textContent()
    expect(content?.length).toBeGreaterThan(100)
  })

  test('로그인 — 페이지 렌더링', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/최애의 관리자/)
    await expect(page.locator('#main-content')).toBeVisible()
  })
})

// ── 에러 페이지 ──────────────────────────────────────────────────────────────

test.describe('에러 처리', () => {
  test('존재하지 않는 페이지 — 404', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz')
    expect(response?.status()).toBe(404)
  })
})
