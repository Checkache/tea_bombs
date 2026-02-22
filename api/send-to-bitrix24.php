<?php
// api/send-to-bitrix24.php
header('Content-Type: application/json');

// Разрешаем запросы с твоего сайта
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Получаем данные из POST-запроса
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Нет данных']);
    exit;
}

// Твой вебхук из Битрикс24
$webhookUrl = 'https://b24-wxz6it.bitrix24.ru/rest/1/tg561scqxeenujv2/';

// Формируем название компании/контакта
$clientName = trim($data['name'] . ' ' . ($data['last_name'] ?? ''));

// Форматируем товары из корзины в читаемый вид
$productsText = '';
$totalAmount = 0;

if (!empty($data['items']) && is_array($data['items'])) {
    foreach ($data['items'] as $item) {
        $productsText .= "• {$item['name']}";
        
        // Проверяем teaSelection (может быть массивом строк)
        if (!empty($item['teaSelection']) && is_array($item['teaSelection'])) {
            $teaNames = $item['teaSelection']; // Уже массив строк
            $productsText .= " (чаи: " . implode(', ', $teaNames) . ")";
        }
        
        $itemTotal = $item['price'] * ($item['quantity'] ?? 1);
        $productsText .= " x{$item['quantity']} - {$itemTotal} ₽\n";
        $totalAmount += $itemTotal;
    }
}

// Добавляем UTM-метки в комментарий
$utmText = '';
if (!empty($data['utms'])) {
    $utmParts = [];
    foreach ($data['utms'] as $key => $value) {
        if ($value) {
            $utmParts[] = "$key: $value";
        }
    }
    if (!empty($utmParts)) {
        $utmText = "UTM: " . implode(', ', $utmParts) . "\n";
    }
}

$comment = "Заказ с сайта Tea Bombs\n\n";
$comment .= "Клиент: {$clientName}\n";
$comment .= "Телефон: {$data['phone']}\n";
$comment .= "Email: " . ($data['email'] ?? 'не указан') . "\n";
if (!empty($data['comment'])) {
    $comment .= "Комментарий: {$data['comment']}\n";
}
$comment .= $utmText . "\n";
$comment .= "Состав заказа:\n{$productsText}\n";
$comment .= "Итого: {$totalAmount} ₽\n";
$comment .= "Дата: " . date('d.m.Y H:i:s');

// Подготавливаем данные для лида в формате Битрикс24
$leadData = [
    'fields' => [
        'TITLE' => 'Заказ с сайта Tea Bombs от ' . $clientName,
        'NAME' => $data['name'] ?? '',
        'LAST_NAME' => $data['last_name'] ?? '',
        'PHONE' => [['VALUE' => $data['phone'], 'VALUE_TYPE' => 'WORK']],
        'EMAIL' => [['VALUE' => $data['email'] ?? '', 'VALUE_TYPE' => 'HOME']],
        'SOURCE_ID' => 'WEB',
        'SOURCE_DESCRIPTION' => 'Форма заказа',
        'COMMENTS' => $comment,
        'OPPORTUNITY' => $totalAmount,
        'CURRENCY_ID' => 'RUB',
    ],
    'params' => ['REGISTER_SONET_EVENT' => 'Y']
];

// Отправляем запрос в Битрикс24
$ch = curl_init($webhookUrl . 'crm.lead.add');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($leadData));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode == 200) {
    $result = json_decode($response, true);
    if (isset($result['result'])) {
        echo json_encode([
            'success' => true,
            'message' => 'Лид успешно создан, ID: ' . $result['result']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Ошибка Битрикс24: ' . ($result['error_description'] ?? 'Неизвестная ошибка')
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Ошибка соединения с Битрикс24'
    ]);
}