import React from "react";
import { Demo, Group, Label } from "../kit";
import { Banner } from "../../ds/components/feedback/Banner";
import { CookieBanner } from "../../ds/components/feedback/CookieBanner";
import { EmptyState } from "../../ds/components/feedback/EmptyState";
import { Modal } from "../../ds/components/feedback/Modal";
import { ProgressBar } from "../../ds/components/feedback/ProgressBar";
import { ProgressCircle } from "../../ds/components/feedback/ProgressCircle";
import { Skeleton } from "../../ds/components/feedback/Skeleton";
import { Snackbar } from "../../ds/components/feedback/Snackbar";
import { StickyBanner } from "../../ds/components/feedback/StickyBanner";
import { Toast } from "../../ds/components/feedback/Toast";
import { Tooltip } from "../../ds/components/feedback/Tooltip";
import { Button } from "../../ds/components/core/Button";
import { IconButton } from "../../ds/components/core/IconButton";

export function Feedback() {
  const [modal, setModal] = React.useState(false);

  return (
    <Group id="feedback" title="Обратная связь" note="Группа feedback — состояния, уведомления и прогресс.">
      <Demo name="Banner" path="components/feedback/Banner" column>
        <Banner tone="info" title="Плановые работы" description="24 августа с 02:00 до 04:00 сервис будет недоступен." onClose={() => undefined} />
        <Banner tone="positive" title="Документ подписан" description="Копия отправлена на почту." />
        <Banner tone="warning" title="Срок истекает" description="Согласуйте смету до 30 августа." action={<Button size="s" variant="secondary">Открыть</Button>} />
        <Banner tone="negative" title="Не удалось сохранить" description="Проверьте соединение и повторите." />
      </Demo>

      <Demo name="Toast · Snackbar" path="components/feedback/" column>
        <div className="sc-row" style={{ alignItems: "flex-start" }}>
          <div className="sc-grow">
            <Label>Toast</Label>
            <div className="sc-stack">
              <Toast tone="positive" title="Сохранено" description="Изменения применены" onClose={() => undefined} />
              <Toast tone="negative" title="Ошибка" description="Файл не загрузился" onClose={() => undefined} />
            </div>
          </div>
          <div className="sc-grow">
            <Label>Snackbar</Label>
            <div className="sc-stack">
              <Snackbar message="Задача перенесена в архив" actionLabel="Отменить" onAction={() => undefined} />
              <Snackbar tone="negative" message="Связь создаёт цикл" onClose={() => undefined} />
            </div>
          </div>
        </div>
      </Demo>

      <Demo name="ProgressBar · ProgressCircle" path="components/feedback/" note="ProgressCircle — новое в v2" column>
        <div className="sc-w360 sc-stack">
          <Label>ProgressBar</Label>
          <ProgressBar value={64} showValue />
          <ProgressBar value={92} tone="positive" />
          <ProgressBar indeterminate />
        </div>
        <div className="sc-row">
          <ProgressCircle value={72} label="72%" description="Загрузка" />
          <ProgressCircle value={100} state="success" size="l" label="Готово" />
          <ProgressCircle value={45} state="pause" label="Пауза" />
          <ProgressCircle value={30} state="error" label="Ошибка" />
          <ProgressCircle value={55} size="s" showValue />
        </div>
      </Demo>

      <Demo name="EmptyState" path="components/feedback/EmptyState" note="пять сценариев · пресеты текста и иконки" column>
        <div className="sc-row">
          <div className="sc-grow">
            <EmptyState variant="empty" action={<Button>Создать документ</Button>} />
          </div>
          <div className="sc-grow">
            <EmptyState variant="not-found" action={<Button variant="secondary">Сбросить фильтры</Button>} />
          </div>
        </div>
        <div className="sc-row">
          <div className="sc-grow">
            <EmptyState variant="no-access" compact action={<Button variant="secondary">Запросить доступ</Button>} />
          </div>
          <div className="sc-grow">
            <EmptyState variant="error" compact action={<Button variant="secondary">Повторить</Button>} />
          </div>
          <div className="sc-grow">
            <EmptyState variant="offline" compact />
          </div>
        </div>
      </Demo>

      <Demo name="Skeleton" path="components/feedback/Skeleton">
        <div className="sc-stack sc-w360">
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="rect" height={80} />
        </div>
        <Skeleton variant="circle" width={56} height={56} />
      </Demo>

      <Demo name="Tooltip" path="components/feedback/Tooltip" note="наведите курсор">
        <Tooltip content="Найти по названию">
          <IconButton icon="SearchSize24StyleOutline" variant="ghost" ariaLabel="Поиск" />
        </Tooltip>
        <Tooltip content="Снизу" placement="bottom">
          <Button variant="secondary">bottom</Button>
        </Tooltip>
        <Tooltip content="Справа" placement="right">
          <Button variant="secondary">right</Button>
        </Tooltip>
      </Demo>

      <Demo name="Modal" path="components/feedback/Modal">
        <Button onClick={() => setModal(true)}>Открыть окно</Button>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Удалить документ?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(false)}>
                Отмена
              </Button>
              <Button variant="negative" onClick={() => setModal(false)}>
                Удалить
              </Button>
            </>
          }
        >
          Документ «Договор №14-2026» будет удалён без возможности восстановления.
        </Modal>
      </Demo>

      <Demo name="StickyBanner · CookieBanner" path="components/feedback/" column>
        <StickyBanner message="Новая версия сервиса уже доступна." actionLabel="Что нового" onAction={() => undefined} onClose={() => undefined} />
        <StickyBanner tone="warning" message="Соединение нестабильно — часть данных может не сохраниться." onClose={() => undefined} />
        <CookieBanner onAccept={() => undefined} onSettings={() => undefined} onClose={() => undefined} />
      </Demo>
    </Group>
  );
}
