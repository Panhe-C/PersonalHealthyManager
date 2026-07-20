import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "./api/account";
import { upcomingReminderTasks, type ReminderTask } from "./notificationSchedule";

export function configureNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  });
}

export async function enableTrainingNotifications(tasks: ReminderTask[]) {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("通知权限未开启，请在系统设置中允许通知。");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("training", { name: "训练提醒", importance: Notifications.AndroidImportance.HIGH });
  }

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter((item) => item.identifier.startsWith("training-")).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));

  const upcoming = upcomingReminderTasks(tasks);
  for (const task of upcoming) {
    const reminderAt = new Date(new Date(task.scheduledStart!).getTime() - 30 * 60 * 1000);
    await Notifications.scheduleNotificationAsync({
      identifier: `training-${task.id}`,
      content: { title: "训练即将开始", body: `${task.title} 将在 30 分钟后开始`, data: { taskId: task.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderAt }
    });
  }

  let remoteRegistered = false;
  const configuredEas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  const projectId = Constants.easConfig?.projectId
    || configuredEas?.projectId
    || String(Constants.expoConfig?.extra?.easProjectId || "").trim();
  if (Device.isDevice && projectId) {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(token.data, Platform.OS);
    remoteRegistered = true;
  }

  return {
    localReminders: upcoming.length,
    remoteRegistered,
    remoteReason: remoteRegistered ? null : Device.isDevice ? "未配置 EAS Project ID" : "模拟器不支持远程推送"
  };
}
