-- Fix: Teachers need INSERT on class_sessions to create sessions when marking attendance
-- Without this, attendance data was lost on refresh because sessions couldn't be created
CREATE POLICY "Teachers can insert own class_sessions" ON class_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.id = class_sessions.teacher_id
      AND teachers.user_id = auth.uid()
    )
  );
