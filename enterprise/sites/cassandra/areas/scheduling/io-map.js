// SCHEDULING I/O Map — Task orchestration blade control modules
// Task queue management, calendar events, deadline monitoring

import { createControlModule } from '../../../../controlmodule.js';

export function buildSchedulingCMs() {
  const taskCM = createControlModule('CM_TASK_QUEUE', {
    name: 'Task Queue Control',
    AI: [
      { id: 'TSK_COUNT', name: 'Task Count', tagPath: 'CASS/SCHED/TASK_COUNT', range: [0, 1000], engUnit: 'count' },
      { id: 'TSK_OVER', name: 'Overdue Tasks', tagPath: 'CASS/SCHED/TASK_OVERDUE', range: [0, 100], engUnit: 'count' },
      { id: 'TSK_HI', name: 'High Priority', tagPath: 'CASS/SCHED/PRIORITY_HIGH', range: [0, 50], engUnit: 'count' },
    ],
    AO: [
      { id: 'TSK_CMD', name: 'Task Command', tagPath: 'CASS/SCHED/TASK_CMD', range: [0, 7], engUnit: 'code' },
    ],
    DI: [
      { id: 'DEADLINE', name: 'Deadline Alert', tagPath: 'CASS/SCHED/DEADLINE_ALERT' },
    ],
    modbus: [
      { register: 53001, type: 'INT16', desc: 'Task count' },
      { register: 53002, type: 'INT16', desc: 'Overdue count' },
    ],
    capability: ['queue', 'prioritize', 'deadline-track'],
  });

  const calendarCM = createControlModule('CM_CALENDAR', {
    name: 'Calendar Control',
    AI: [
      { id: 'EVT_TODAY', name: 'Events Today', tagPath: 'CASS/SCHED/EVENTS_TODAY', range: [0, 50], engUnit: 'count' },
      { id: 'CONFLICTS', name: 'Scheduling Conflicts', tagPath: 'CASS/SCHED/CONFLICTS', range: [0, 10], engUnit: 'count' },
    ],
    DO: [
      { id: 'REMIND', name: 'Fire Reminder', tagPath: 'CASS/SCHED/FIRE_REMIND' },
    ],
    modbus: [
      { register: 53004, type: 'INT16', desc: 'Events today' },
      { register: 53005, type: 'INT16', desc: 'Conflicts' },
    ],
    capability: ['schedule', 'conflict-detect', 'remind'],
  });

  return { taskCM, calendarCM };
}
