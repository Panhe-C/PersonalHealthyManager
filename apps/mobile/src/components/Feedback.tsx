import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./Button";
import { Text } from "./Text";
import { opacity, radius, spacing, useTheme } from "../theme/tokens";

type NoticeTone = "success" | "danger" | "neutral";

type NoticeRequest = { title: string; description?: string; tone?: NoticeTone };

type ConfirmRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type FeedbackApi = {
  notify: (request: NoticeRequest) => void;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
};

type PendingConfirm = ConfirmRequest & { resolve: (confirmed: boolean) => void };

const NOTICE_DURATION_MS = 3400;

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const api = useContext(FeedbackContext);
  if (!api) throw new Error("useFeedback 需要在 FeedbackProvider 内使用");
  return api;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<(NoticeRequest & { id: number }) | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const noticeCount = useRef(0);

  const notify = useCallback((request: NoticeRequest) => {
    noticeCount.current += 1;
    setNotice({ ...request, id: noticeCount.current });
  }, []);

  const confirm = useCallback(
    (request: ConfirmRequest) => new Promise<boolean>((resolve) => setPending({ ...request, resolve })),
    []
  );

  const settle = useCallback(
    (confirmed: boolean) => {
      if (!pending) return;
      pending.resolve(confirmed);
      setPending(null);
    },
    [pending]
  );

  const api = useMemo(() => ({ notify, confirm }), [confirm, notify]);

  return (
    <FeedbackContext.Provider value={api}>
      <View style={styles.host}>
        {children}
        {notice ? <NoticeBanner key={notice.id} notice={notice} onDismiss={() => setNotice(null)} /> : null}
      </View>
      <ConfirmSheet request={pending} onSettle={settle} />
    </FeedbackContext.Provider>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: NoticeRequest; onDismiss: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) dismissRef.current();
        }
      );
    }, NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [progress]);

  const accent = notice.tone === "danger" ? tokens.danger : notice.tone === "neutral" ? tokens.lineStrong : tokens.sage;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.noticeLayer,
        {
          paddingTop: insets.top + spacing.sm,
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }]
        }
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={notice.title}
        onPress={onDismiss}
        style={({ pressed }) => [
          styles.notice,
          { backgroundColor: tokens.panel, borderColor: tokens.line },
          pressed && { opacity: opacity.pressed }
        ]}
      >
        <View style={[styles.noticeAccent, { backgroundColor: accent }]} />
        <View style={styles.noticeCopy}>
          <Text weight="medium" style={{ color: tokens.inkStrong }}>{notice.title}</Text>
          {notice.description ? <Text size="sm" style={{ color: tokens.muted }}>{notice.description}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ConfirmSheet({ request, onSettle }: { request: PendingConfirm | null; onSettle: (confirmed: boolean) => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={() => onSettle(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => onSettle(false)}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: tokens.panel, borderColor: tokens.line, paddingBottom: Math.max(insets.bottom, spacing.lg) }
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.sheetHandle, { backgroundColor: tokens.lineStrong }]} />
          <View style={styles.sheetCopy}>
            <Text size="xl" weight="strong" style={{ color: tokens.inkStrong }}>{request?.title}</Text>
            {request?.description ? <Text style={{ color: tokens.muted }}>{request.description}</Text> : null}
          </View>
          <View style={styles.sheetActions}>
            <Button
              title={request?.confirmLabel ?? "确认"}
              variant={request?.destructive ? "danger" : "primary"}
              onPress={() => onSettle(true)}
            />
            <Button title={request?.cancelLabel ?? "取消"} variant="ghost" onPress={() => onSettle(false)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  notice: {
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  noticeAccent: { borderRadius: 2, height: 32, width: 3 },
  noticeCopy: { flex: 1, gap: 2 },
  noticeLayer: { left: 0, paddingHorizontal: spacing.lg, position: "absolute", right: 0, top: 0 },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  sheetActions: { gap: spacing.sm },
  sheetBackdrop: { backgroundColor: "rgba(18, 24, 20, 0.34)", flex: 1, justifyContent: "flex-end" },
  sheetCopy: { gap: spacing.sm },
  sheetHandle: { alignSelf: "center", borderRadius: 2, height: 4, marginBottom: spacing.xs, width: 40 }
});
