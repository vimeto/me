import { Quiz } from '../src/components/mdx/blocks/Quiz'

export default {
  title: 'Blocks / Quiz',
}

export const SingleSelect = () => (
  <Quiz
    question="Which palette key do callouts labelled 'info' use?"
    choices={[
      { text: 'amber' },
      { text: 'teal', correct: true },
      { text: 'violet' },
      { text: 'coral' },
    ]}
    explanation="info maps to teal; warn→amber, insight→violet, aside→lime."
  />
)

export const MultiSelect = () => (
  <Quiz
    multiSelect
    question="Which of these blocks are registered in the v2 pipeline?"
    choices={[
      { text: 'Figure', correct: true },
      { text: 'Callout', correct: true },
      { text: 'ParamPlot', correct: true },
      { text: 'Bibliography' },
      { text: 'Quiz', correct: true },
    ]}
    explanation="Bibliography isn't in the registry yet — the rest are."
  />
)

export const WithoutExplanation = () => (
  <Quiz
    question="Is this a single-select question?"
    choices={[{ text: 'Yes', correct: true }, { text: 'No' }]}
  />
)
