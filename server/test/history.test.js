const
  request = require('supertest'),
  Long = require('long'),

wfHistoryThrift = [{
  eventId: new Long(1),
  timestamp: new Long(800610625, 351737684, false),
  eventType: 'WorkflowExecutionStarted',
  workflowExecutionStartedEventAttributes: {
    workflowType: {
      name: 'github.com/uber/cadence/demo'
    },
    taskList: {
      name: 'ci-task-queue',
      kind: null
    },
    identity: null,
    input: null,
    taskStartToCloseTimeoutSeconds: 30,
    executionStartToCloseTimeoutSeconds: 1080
  }
}, {
  eventId: new Long(2),
  timestamp: new Long(800610625, 351737684, false),
  eventType: 'DecisionTaskScheduled',
  decisionTaskScheduledEventAttributes: {
    startToCloseTimeoutSeconds: 180,
    attempt: 1,
    taskList: {
      name: 'canary-task-queue',
      kind: null
    }
  }
}, {
  eventId: new Long(3),
  timestamp: new Long(800610625, 351737688, false),
  eventType: 'DecisionTaskStarted',
  decisionTaskStartedEventAttributes: {
    identity: 'box1@ci-task-queue',
    requestId: 'fafa095d-b4ca-423a-a812-223e62b5ccf8',
    scheduledEventId: new Long(2)
  }
}],

wfHistoryJson = [{
    eventId: 1,
    timestamp: '2017-11-14T23:24:10.351Z',
    eventType: 'WorkflowExecutionStarted',
    details: wfHistoryThrift[0].workflowExecutionStartedEventAttributes
  }, {
    eventId: 2,
    timestamp: '2017-11-14T23:24:10.351Z',
    eventType: 'DecisionTaskScheduled',
    details: wfHistoryThrift[1].decisionTaskScheduledEventAttributes
  },
  {
    eventId: 3,
    timestamp: '2017-11-14T23:24:27.531Z',
    eventType: 'DecisionTaskStarted',
    details: {
      identity: 'box1@ci-task-queue',
      requestId: 'fafa095d-b4ca-423a-a812-223e62b5ccf8',
      scheduledEventId: 2,
    }
  }
]

describe('Workflow History', function() {
  it('should forward the request to the cadence frontend with workflowId and runId', function() {
    this.test.GetWorkflowExecutionHistory = ({ getRequest }) => {
      getRequest.should.deep.equal({
        HistoryEventFilterType: null,
        domain: 'canary',
        execution: {
          workflowId: 'ci/demo',
          runId: 'run1'
        },
        maximumPageSize: 100,
        nextPageToken: null,
        waitForNewEvent: null
      })

      return {
        history: { events: wfHistoryThrift },
        nextPageToken: new Buffer('page2')
      }
    }

    return request(global.app)
      .get('/api/domain/canary/workflows/history/ci%2Fdemo/run1')
      .expect(200)
      .expect('Content-Type', /json/)
  })

  it('should forward the nextPageToken', function() {
    this.test.GetWorkflowExecutionHistory = ({ getRequest }) => {
      getRequest.nextPageToken.toString().should.equal('page2')

      return {
        history: { events: [] },
        nextPageToken: new Buffer('page3')
      }
    }

    return request(global.app)
      .get('/api/domain/canary/workflows/history/ci%2Fdemo/run1?nextPageToken=cGFnZTI%3D')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({
        history: { events: [] },
        nextPageToken: 'cGFnZTM='
      })
  })

  it('should support long polling by forwarding the waitForNewEvent flag', function() {
    this.test.GetWorkflowExecutionHistory = ({ getRequest }) => {
      getRequest.waitForNewEvent.should.be.true
      return { history: { events: [{ eventId: 1 }] } }
    }

    return request(global.app)
      .get('/api/domain/canary/workflows/history/ci%2Fdemo/run1?waitForNewEvent=true')
      .expect(200)
      .expect('Content-Type', /json/)
      .then(() =>  request(global.app)
        .get('/api/domain/canary/workflows/history/ci%2Fdemo/run1?waitForNewEvent')
        .expect(200)
      )
  })

  it('should transform Long numbers to JavaScript numbers, and Long dates to ISO date strings', function() {
    this.test.GetWorkflowExecutionHistory = ({ getRequest }) => ({
      history: { events: wfHistoryThrift },
      nextPageToken: new Buffer('page2')
    })


    return request(global.app)
      .get('/api/domain/canary/workflows/history/ci%2Fdemo/run1')
      .expect(200)
      .expect({
        history: { events: wfHistoryJson },
        nextPageToken: 'cGFnZTI='
      })
  })
})