/**
 * Build a register-style view of cohort attendance: one row per student with
 * cumulative totals, plus a per-session matrix and a cohort summary. Shared by
 * the teacher, admin and student dashboards so the numbers always agree.
 */
export function buildAttendanceRegister({ classroom, sessions, records }) {
    const sessionList = [...sessions].sort(
        (a, b) => new Date(a.startsAt) - new Date(b.startsAt),
    );
    const sessionIndex = new Map(
        sessionList.map((session, index) => [session._id.toString(), index]),
    );

    const rows = (classroom.students ?? []).map((student) => ({
        student,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        bySession: {},
    }));
    const rowByStudent = new Map(
        rows.map((row) => [row.student._id.toString(), row]),
    );

    const summary = {
        sessions: sessionList.length,
        records: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
    };

    for (const record of records) {
        const studentId = record.student?.toString?.() ?? String(record.student);
        const sessionId = record.session?.toString?.() ?? String(record.session);
        summary.records += 1;
        if (summary[record.status] !== undefined) summary[record.status] += 1;
        const row = rowByStudent.get(studentId);
        if (!row) continue;
        if (row.bySession[sessionId] === undefined) {
            row.bySession[sessionId] = record.status;
            row[record.status] += 1;
            row.total += 1;
        }
    }

    const students = rows.map((row) => {
        const attended = row.present + row.late;
        return {
            ...(row.student.toObject ? row.student.toObject() : row.student),
            present: row.present,
            absent: row.absent,
            late: row.late,
            excused: row.excused,
            total: row.total,
            attendanceRate: row.total > 0 ? Math.round((attended / row.total) * 100) : 0,
            bySession: row.bySession,
        };
    });

    const attended = summary.present + summary.late;
    summary.attendanceRate =
        summary.records > 0 ? Math.round((attended / summary.records) * 100) : 0;

    return {
        sessions: sessionList.map((session) => ({
            _id: session._id,
            title: session.title,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            status: session.status,
            recurrencePattern: session.recurrencePattern ?? "none",
            index: sessionIndex.get(session._id.toString()),
        })),
        students,
        summary,
    };
}
