from flask import Flask, request, jsonify, send_from_directory
import os, json

app = Flask(__name__, static_folder='.', static_url_path='')

DATA_PATH = os.path.join('data', 'controleDados.json')

def ensure_data_file():
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    if not os.path.exists(DATA_PATH):
        with open(DATA_PATH, 'w', encoding='utf-8') as f:
            json.dump({"municipios": []}, f, ensure_ascii=False, indent=2)

@app.route('/api/dados', methods=['GET'])
def get_dados():
    ensure_data_file()
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

@app.route('/api/dados', methods=['POST'])
def post_dados():
    payload = request.get_json()
    ensure_data_file()
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return jsonify({"status":"ok"})

# Rota catch-all para servir seus arquivos estáticos
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def static_proxy(path):
    if path and os.path.exists(path):
        return send_from_directory('.', path)
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(port=8000)
