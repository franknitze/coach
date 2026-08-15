<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

require_method('POST');
auth_require();
auth_logout();

json_out(['ok' => true]);
