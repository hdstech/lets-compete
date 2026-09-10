import { expect, test } from '@playwright/test'
import {
  addAcceptableAnswer,
  addQuestion,
  addRound,
  addSegment,
  createDraftEvent,
  deleteCurrentEvent,
  goToQuestions,
  goToRounds,
  goToSegments,
  uniqueEventName,
} from './helpers'

// Covers QB1 (admin question authoring UI + tiebreak reserve pool) against
// the real Supabase backend: adding a question with its answer window and
// answer type, attaching acceptable answers for the auto pre-mark matcher,
// marking a question as part of the tiebreak reserve pool, editing a
// question, and deleting one. Deliberately skips exercising reveal/window
// lifecycle (status/reveal_token/etc.) — those belong to QA5/QA8, not this
// authoring UI.

async function setUpToQuestions(page: import('@playwright/test').Page, eventName: string) {
  await createDraftEvent(page, eventName)
  await goToRounds(page)
  await addRound(page, { name: 'Round 1', advancementN: 8 })
  await goToSegments(page)
  await addSegment(page, { name: 'History' })
  await goToQuestions(page)
}

test('adding a question shows it in the list with its config', async ({ page }) => {
  const name = uniqueEventName('Question Add')
  await setUpToQuestions(page, name)

  await addQuestion(page, { prompt: 'What year did WWII end?', windowSeconds: 20 })

  await expect(page.getByRole('heading', { level: 2, name: 'Question 1' })).toBeVisible()
  await expect(page.getByText('What year did WWII end?')).toBeVisible()
  await expect(page.getByText('20s')).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('marking a question as tiebreak reserve labels it in the list', async ({ page }) => {
  const name = uniqueEventName('Question Tiebreak')
  await setUpToQuestions(page, name)

  await addQuestion(page, {
    prompt: 'Reserve question',
    windowSeconds: 15,
    isTiebreak: true,
  })

  await expect(
    page.getByRole('heading', { level: 2, name: 'Question 1 (tiebreak reserve)' }),
  ).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('adding an acceptable answer attaches it to the question', async ({ page }) => {
  const name = uniqueEventName('Question Answer')
  await setUpToQuestions(page, name)

  await addQuestion(page, { prompt: 'What is the capital of France?', windowSeconds: 20 })
  await addAcceptableAnswer(page, { value: 'Paris' })

  await expect(page.getByText('Paris', { exact: true })).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('a question and its acceptable answers save together in one action', async ({ page }) => {
  const name = uniqueEventName('Question With Answers')
  await setUpToQuestions(page, name)

  // Stage two acceptable answers on the create form, then save once — no
  // separate "add answer" step after the question is created.
  await addQuestion(page, {
    prompt: 'Name a primary color',
    windowSeconds: 20,
    acceptableAnswers: ['Red', 'Blue'],
  })

  await expect(page.getByRole('heading', { level: 2, name: 'Question 1' })).toBeVisible()
  await expect(page.getByText('Red', { exact: true })).toBeVisible()
  await expect(page.getByText('Blue', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Red', { exact: true })).toBeVisible()
  await expect(page.getByText('Blue', { exact: true })).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('a True/False question stores the chosen correct answer', async ({ page }) => {
  const name = uniqueEventName('Question TrueFalse')
  await setUpToQuestions(page, name)

  await addQuestion(page, {
    prompt: 'The Sea of Galilee is a freshwater lake.',
    answerType: 'boolean',
    windowSeconds: 20,
    correctAnswer: 'True',
  })

  // The card reports the type and the picker reflects the stored answer —
  // 'True' here rather than the create form's own "True/False" type radio.
  await expect(page.getByRole('definition').filter({ hasText: 'True/False' })).toBeVisible()
  const trueOption = page.getByRole('radio', { name: 'True', exact: true })
  const falseOption = page.getByRole('radio', { name: 'False', exact: true })
  await expect(trueOption).toBeChecked()

  // Re-picking replaces the stored answer rather than adding a second one.
  // Clicked rather than checked: the radio reflects the new value only once
  // the write it kicks off comes back, which check() doesn't wait for.
  await falseOption.click()
  await expect(falseOption).toBeChecked()
  await page.reload()
  await expect(page.getByRole('radio', { name: 'False', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'True', exact: true })).not.toBeChecked()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('editing an acceptable answer persists across a reload', async ({ page }) => {
  const name = uniqueEventName('Question Answer Edit')
  await setUpToQuestions(page, name)

  await addQuestion(page, {
    prompt: 'What is the capital of France?',
    windowSeconds: 20,
    acceptableAnswers: ['Pariz'],
  })

  await page.getByRole('button', { name: 'Edit answer Pariz' }).click()
  await page.getByLabel('Edit acceptable answer Pariz').fill('Paris')
  await page.getByRole('button', { name: 'Save answer' }).click()

  await expect(page.getByText('Paris', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Paris', { exact: true })).toBeVisible()
  await expect(page.getByText('Pariz', { exact: true })).toHaveCount(0)

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('a question cannot be saved without an acceptable answer', async ({ page }) => {
  const name = uniqueEventName('Question Answer Gate')
  await setUpToQuestions(page, name)

  await page.getByLabel('Prompt').fill('Needs an acceptable answer')
  const stageAnswer = page.getByRole('button', { name: 'Add acceptable answer' })
  const addQuestionButton = page.getByRole('button', { name: 'Add question' })
  await expect(stageAnswer).toBeDisabled()
  await expect(addQuestionButton).toBeDisabled()

  await page.getByLabel('Acceptable answer for the new question').fill('An answer')
  await expect(stageAnswer).toBeEnabled()
  await expect(addQuestionButton).toBeEnabled()
  await addQuestionButton.click()

  // The same rule on the saved question's own answer form.
  await expect(page.getByRole('heading', { level: 2, name: 'Question 1' })).toBeVisible()
  const addAnswerButton = page.getByRole('button', { name: 'Add answer' })
  await expect(addAnswerButton).toBeDisabled()
  await page.getByPlaceholder('Acceptable answer value').fill('Another answer')
  await expect(addAnswerButton).toBeEnabled()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('editing a question persists across a reload', async ({ page }) => {
  const name = uniqueEventName('Question Edit')
  await setUpToQuestions(page, name)

  await addQuestion(page, { prompt: 'Original prompt', windowSeconds: 20 })

  // Exact: the answer rows carry their own "Edit answer …" buttons.
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Prompt').fill('Updated prompt')
  await page.getByLabel('Answer window (seconds)').fill('45')
  await page.getByRole('button', { name: 'Save question' }).click()

  await expect(page.getByText('Updated prompt')).toBeVisible()
  await expect(page.getByText('45s')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Updated prompt')).toBeVisible()
  await expect(page.getByText('45s')).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('deleting a question removes it from the list', async ({ page }) => {
  const name = uniqueEventName('Question Delete')
  await setUpToQuestions(page, name)

  await addQuestion(page, { prompt: 'Doomed question', windowSeconds: 20 })
  await expect(page.getByRole('heading', { level: 2, name: 'Question 1' })).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No questions yet.')).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})
