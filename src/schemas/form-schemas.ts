const formSchemas = {
  // Assessment Form
  assessment: {
    plan: {
      advice: '',
      plans: [
        {
          exercise: '',
          comments: '',
          set: [
            {
              repetitions: 0,
              load: '',
              unit: '',
            },
          ],
          duration: {
            value: 0,
            unit: '',
          },
        },
      ],
    },
    subjectiveAssessment: {
      assessment: '',
    },
    objectiveAssessment: {
      tests: [
        {
          testName: '',
          unitName: '',
          value: 0,
          left: 0,
          right: 0,
          comments: '',
        },
      ],
    },
    rpe: {
      value: 0,
    },
  },
  // SNC Form
  snc: {
    plan: {
      advice: '',
      plans: [
        {
          exercise: '',
          comments: '',
          set: [
            {
              repetitions: 0,
              load: '',
              unit: '',
            },
          ],
          duration: {
            value: 0,
            unit: '',
          },
        },
      ],
    },
  },
};

export default formSchemas;

