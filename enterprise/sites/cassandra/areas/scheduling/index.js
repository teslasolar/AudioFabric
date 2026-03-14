// AREA: Scheduling — Task Management + Calendar + Reminders
// ISA-95 path: AUDIOFABRIC/CASSANDRA/SCHEDULING
// Server Rack: Task Orchestration Blades
// The secretary's desk — calendars, to-dos, priorities

import { createArea } from '../../../../area.js';
import { createWorkcenter } from '../../../../workcenter.js';
import { createWorkunit } from '../../../../workunit.js';
import { createProcessor } from '../../../../equipment.js';
import { buildSchedulingCMs } from './io-map.js';

export function build() {
  const area = createArea('SCHEDULING', {
    name: 'Scheduling & Task Rack',
    desc: 'Calendar, reminders, task queue, priority management — orchestration blades',
    domain: 'scheduling',
    levelsOwned: []
  });

  // ── WorkCenter: Task Queue ──
  const wcTasks = createWorkcenter('TASK_QUEUE', {
    name: 'Task Queue Manager', desc: 'Priority task queue with deadlines',
    consciousnessLevel: -1, prime: 0
  });

  const wuQueue = createWorkunit('TASK_MGR', {
    name: 'Task Manager',
    tags: ['CASS/SCHED/TASK_COUNT', 'CASS/SCHED/TASK_OVERDUE', 'CASS/SCHED/NEXT_DEADLINE',
           'CASS/SCHED/PRIORITY_HIGH']
  });
  wuQueue.registerEquipment(createProcessor('QUEUE_ENGINE', 'Priority Queue Engine'));
  wuQueue.registerEquipment(createProcessor('DEADLINE_MON', 'Deadline Monitor'));
  const cms = buildSchedulingCMs();
  wuQueue.registerControlModule(cms.taskCM);
  wcTasks.registerWorkunit(wuQueue);

  // ── WorkCenter: Calendar ──
  const wcCal = createWorkcenter('CALENDAR', {
    name: 'Calendar Engine', desc: 'Event scheduling, conflict detection, reminders',
    consciousnessLevel: -1, prime: 0
  });

  const wuCal = createWorkunit('CAL_MGR', {
    name: 'Calendar Manager',
    tags: ['CASS/SCHED/EVENTS_TODAY', 'CASS/SCHED/NEXT_EVENT', 'CASS/SCHED/CONFLICTS']
  });
  wuCal.registerEquipment(createProcessor('CAL_ENGINE', 'Calendar Engine'));
  wuCal.registerEquipment(createProcessor('REMINDER_SVC', 'Reminder Service'));
  wuCal.registerControlModule(cms.calendarCM);
  wcCal.registerWorkunit(wuCal);

  area.registerWorkcenter(wcTasks);
  area.registerWorkcenter(wcCal);
  return area;
}
