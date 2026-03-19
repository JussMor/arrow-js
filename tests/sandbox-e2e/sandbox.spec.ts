import { expect, test } from '@playwright/test'

test('sandbox demo mounts, updates through the VM path, and swaps examples', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        current: {
          apparent_temperature: 66,
          temperature_2m: 68,
          time: '2026-03-19T12:00',
          weather_code: 1,
          wind_speed_10m: 14,
        },
      }),
    })
  })

  await page.goto('/')

  const status = page.locator('[data-status]')
  await expect(status).toContainText('Mounted')

  const preview = page.locator('[data-preview]')
  const counterButton = preview.locator('button')
  await expect(counterButton).toHaveText(/Clicked 0/)

  await counterButton.click()
  await expect(counterButton).toHaveText(/Clicked 1/)

  await page.getByRole('button', { name: 'Split Files' }).click()
  await page.getByRole('button', { name: 'Mount Fresh' }).click()
  await expect(status).toContainText('Mounted "Split Files"')

  const splitButton = preview.locator('button')
  const splitCount = preview.locator('span')

  await expect(splitCount).toHaveText('0')
  await splitButton.click()
  await expect(splitCount).toHaveText('1')

  await page.getByRole('button', { name: 'Weather App' }).click()
  await page.getByRole('button', { name: 'Mount Fresh' }).click()
  await expect(status).toContainText('Mounted "Weather App"')

  const weatherSelect = preview.locator('select.weather-select')
  await expect(weatherSelect).toBeVisible()
  await expect(preview.locator('.weather-kicker')).toContainText('New York')
  await expect(preview.locator('.weather-temp')).toContainText('68°')

  await weatherSelect.selectOption('denver')
  await expect(preview.locator('.weather-kicker')).toContainText('Denver')
  await expect(preview.locator('.weather-summary')).toContainText('Mostly clear')
})
