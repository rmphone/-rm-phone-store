import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const money = n => `${Number(n || 0).toLocaleString('fr-MA')} DH`;

const categories = [
  'الكل',
  'هواتف',
  'إكسسوارات',
  'شواحن',
  'سماعات',
  'حماية',
  'أخرى'
];

export default function App() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('الكل');
  const [cart, setCart] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const [adminOpen, setAdminOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [orders, setOrders] = useState([]);
  const [repairs, setRepairs] = useState([]);

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    city: '',
    address: ''
  });

  const [repair, setRepair] = useState({
    customer_name: '',
    phone: '',
    city: '',
    address: '',
    device: '',
    problem: '',
    service_type: 'إصلاح'
  });

  const [productForm, setProductForm] = useState({
    id: null,
    name: '',
    description: '',
    price: '',
    category: 'هواتف',
    stock: '1',
    image_url: '',
    active: true
  });

  const [imageFile, setImageFile] = useState(null);

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (!error) {
      setProducts(data || []);
    }
  };

  const loadAdminData = async () => {
    const [o, r] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('repair_requests')
        .select('*')
        .order('created_at', { ascending: false })
    ]);

    if (o.error) {
      setNotice('خطأ تحميل الطلبات: ' + o.error.message);
    } else {
      setOrders(o.data || []);
    }

    if (r.error) {
      setNotice('خطأ تحميل طلبات الإصلاح: ' + r.error.message);
    } else {
      setRepairs(r.data || []);
    }
  };  useEffect(() => {
    loadProducts();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      checkAdmin();
    } else {
      setAdmin(false);
      setOrders([]);
      setRepairs([]);
    }
  }, [session]);

  const checkAdmin = async () => {
    const { data, error } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      setNotice('خطأ التحقق من الإدارة: ' + error.message);
      setAdmin(false);
      return;
    }

    setAdmin(!!data);

    if (data) {
      loadAdminData();
    }
  };

  const filtered = useMemo(() => {
    return category === 'الكل'
      ? products
      : products.filter(p => p.category === category);
  }, [products, category]);

  const addCart = p => {
    setCart(old => {
      const found = old.find(x => x.id === p.id);

      return found
        ? old.map(x =>
            x.id === p.id
              ? { ...x, qty: x.qty + 1 }
              : x
          )
        : [...old, { ...p, qty: 1 }];
    });

    setNotice('تمت إضافة المنتج إلى السلة');
  };

  const changeQty = (id, amount) => {
    setCart(old =>
      old
        .map(p =>
          p.id === id
            ? { ...p, qty: p.qty + amount }
            : p
        )
        .filter(p => p.qty > 0)
    );
  };

  const removeCart = id => {
    setCart(old => old.filter(p => p.id !== id));
  };

  const total = cart.reduce(
    (sum, p) => sum + Number(p.price) * p.qty,
    0
  );

  const sendOrder = async e => {
    e.preventDefault();

    if (!cart.length) {
      setNotice('السلة فارغة');
      return;
    }

    setBusy(true);

    const orderData = {
      ...form,
      items: cart.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        qty: p.qty
      })),
      total,
      delivery_fee: 0
    };

    const { error } = await supabase
      .from('orders')
      .insert(orderData);

    setBusy(false);

    if (error) {
      setNotice('تعذر إرسال الطلب: ' + error.message);
    } else {
      setNotice('تم إرسال طلبك بنجاح! سنتصل بك للتأكيد.');

      setCart([]);

      setForm({
        customer_name: '',
        phone: '',
        city: '',
        address: ''
      });

      if (admin) {
        loadAdminData();
      }
    }
  };

  const sendRepair = async e => {
    e.preventDefault();

    setBusy(true);

    const { error } = await supabase
      .from('repair_requests')
      .insert(repair);

    setBusy(false);

    if (error) {
      setNotice('تعذر إرسال طلب الإصلاح: ' + error.message);
    } else {
      setNotice('تم إرسال طلب الإصلاح، سنتصل بك قريباً.');

      setRepair({
        customer_name: '',
        phone: '',
        city: '',
        address: '',
        device: '',
        problem: '',
        service_type: 'إصلاح'
      });

      if (admin) {
        loadAdminData();
      }
    }
  };  const login = async e => {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setNotice('تعذر الدخول: ' + error.message);
    } else {
      setPassword('');
      setNotice('تم تسجيل الدخول');
    }
  };

  const saveProduct = async e => {
    e.preventDefault();

    if (!admin) return;

    let image_url = productForm.image_url;

    if (imageFile) {
      const path = `${Date.now()}-${imageFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '-'
      )}`;

      const { error: upErr } = await supabase.storage
        .from('products')
        .upload(path, imageFile, { upsert: true });

      if (upErr) {
        setNotice('خطأ رفع الصورة: ' + upErr.message);
        return;
      }

      image_url = supabase.storage
        .from('products')
        .getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name: productForm.name,
      description: productForm.description,
      price: Number(productForm.price),
      category: productForm.category,
      stock: Number(productForm.stock),
      image_url,
      active: productForm.active
    };

    const result = productForm.id
      ? await supabase
          .from('products')
          .update(payload)
          .eq('id', productForm.id)
      : await supabase
          .from('products')
          .insert(payload);

    if (result.error) {
      setNotice('خطأ حفظ المنتج: ' + result.error.message);
    } else {
      setNotice('تم حفظ المنتج بنجاح');

      setProductForm({
        id: null,
        name: '',
        description: '',
        price: '',
        category: 'هواتف',
        stock: '1',
        image_url: '',
        active: true
      });

      setImageFile(null);
      loadProducts();
    }
  };

  const editProduct = p => {
    setProductForm({ ...p });
    setImageFile(null);
    setNotice('يمكنك الآن تعديل المنتج');
  };

  const deleteProduct = async id => {
    if (!confirm('حذف هذا المنتج؟')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      setNotice('خطأ الحذف: ' + error.message);
    } else {
      setNotice('تم حذف المنتج');
      loadProducts();
    }
  };

  const updateStatus = async (table, id, status) => {
    const { error } = await supabase
      .from(table)
      .update({ status })
      .eq('id', id);

    if (error) {
      setNotice(error.message);
    } else {
      setNotice('تم تحديث الحالة');
      loadAdminData();
    }
  };

  const getOrderItems = items => {
    if (Array.isArray(items)) {
      return items;
    }

    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  };

  const dateText = date => {
    if (!date) return '';

    return new Date(date).toLocaleString('fr-MA');
  };

  return (
    <div>
      <header className="top">
        <div className="wrap nav">
          <a className="brand" href="#">
            <span>RM</span> PHONE
          </a>

          <nav>
            <a href="#products">المنتجات</a>
            <a href="#repair">إصلاح الهواتف</a>
            <a href="#contact">اتصل بنا</a>
          </nav>

          <button
            className="adminBtn"
            onClick={() => {
              setAdminOpen(true);

              setTimeout(() => {
                document
                  .getElementById('admin')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
          >
            لوحة الإدارة
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap heroGrid">
            <div>
              <p className="tag">RM PHONE • بيع وصيانة</p>

              <h1>
                كل ما يحتاجه هاتفك
                <br />
                <em>في مكان واحد</em>
              </h1>

              <p>
                هواتف، إكسسوارات، شواحن وسماعات، مع خدمات إصلاح احترافية.
              </p>

              <a className="primary" href="#products">
                تسوق الآن
              </a>
            </div>

            <div className="heroCard">
              <div className="phone">RM</div>
              <b>RM PHONE</b>
              <small>بيع • إكسسوارات • صيانة</small>
            </div>
          </div>
        </section>        <section id="products" className="section wrap">
          <div className="sectionHead">
            <div>
              <p className="tag">اختياراتنا</p>
              <h2>منتجات المتجر</h2>
            </div>

            <span className="count">
              {filtered.length} منتج
            </span>
          </div>

          <div className="chips">
            {categories.map(c => (
              <button
                className={category === c ? 'selected' : ''}
                onClick={() => setCategory(c)}
                key={c}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid">
            {filtered.map(p => (
              <article className="card" key={p.id}>
                <div className="productImg">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} />
                  ) : (
                    <span>RM</span>
                  )}
                </div>

                <div className="cardBody">
                  <small>{p.category}</small>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>

                  <div className="cardFoot">
                    <b>{money(p.price)}</b>
                    <button onClick={() => addCart(p)}>
                      أضف للسلة +
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!filtered.length && (
            <div className="empty">
              لا توجد منتجات حالياً. أضف منتجاتك من لوحة الإدارة.
            </div>
          )}
        </section>

        <section className="section pale">
          <div className="wrap columns">
            <div>
              <p className="tag">طلب سريع</p>
              <h2>سلة المشتريات</h2>
              <p>راجع منتجاتك وأرسل الطلب، وسنتصل بك لتأكيده.</p>

              <div className="cart">
                {cart.length ? (
                  cart.map(p => (
                    <div className="cartRow" key={p.id}>
                      <span>
                        {p.name} × {p.qty}
                      </span>

                      <div>
                        <b>{money(p.price * p.qty)}</b>

                        <button
                          type="button"
                          onClick={() => changeQty(p.id, -1)}
                        >
                          −
                        </button>

                        <button
                          type="button"
                          onClick={() => changeQty(p.id, 1)}
                        >
                          +
                        </button>

                        <button
                          type="button"
                          onClick={() => removeCart(p.id)}
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>السلة فارغة حالياً.</p>
                )}

                <div className="cartTotal">
                  <b>المجموع</b>
                  <strong>{money(total)}</strong>
                </div>
              </div>
            </div>

            <form className="panel" onSubmit={sendOrder}>
              <h3>معلومات التوصيل</h3>

              <input
                required
                placeholder="الاسم الكامل"
                value={form.customer_name}
                onChange={e =>
                  setForm({ ...form, customer_name: e.target.value })
                }
              />

              <input
                required
                placeholder="رقم الهاتف"
                value={form.phone}
                onChange={e =>
                  setForm({ ...form, phone: e.target.value })
                }
              />

              <input
                required
                placeholder="المدينة"
                value={form.city}
                onChange={e =>
                  setForm({ ...form, city: e.target.value })
                }
              />

              <input
                placeholder="العنوان"
                value={form.address}
                onChange={e =>
                  setForm({ ...form, address: e.target.value })
                }
              />

              <button
                className="primary full"
                disabled={busy || !cart.length}
              >
                {busy ? 'جار الإرسال...' : 'تأكيد الطلب'}
              </button>

              <small>
                التوصيل 0 DH حالياً، يتم تأكيد التفاصيل هاتفياً.
              </small>
            </form>
          </div>
        </section>

        <section id="repair" className="section wrap">
          <div className="columns">
            <div>
              <p className="tag">خدماتنا</p>
              <h2>هاتفك يحتاج إصلاح؟</h2>

              <p>
                أرسل لنا نوع الجهاز والمشكل وسنتواصل معك لتحديد الخدمة المناسبة.
              </p>

              <ul className="services">
                <li>تغيير الشاشات والبطاريات</li>
                <li>إصلاح مشاكل الشحن والصوت</li>
                <li>تشخيص وصيانة الهواتف</li>
              </ul>
            </div>

            <form className="panel" onSubmit={sendRepair}>
              <h3>طلب إصلاح هاتف</h3>

              <input
                required
                placeholder="الاسم الكامل"
                value={repair.customer_name}
                onChange={e =>
                  setRepair({ ...repair, customer_name: e.target.value })
                }
              />

              <input
                required
                placeholder="رقم الهاتف"
                value={repair.phone}
                onChange={e =>
                  setRepair({ ...repair, phone: e.target.value })
                }
              />

              <input
                required
                placeholder="المدينة"
                value={repair.city}
                onChange={e =>
                  setRepair({ ...repair, city: e.target.value })
                }
              />

              <input
                placeholder="العنوان"
                value={repair.address}
                onChange={e =>
                  setRepair({ ...repair, address: e.target.value })
                }
              />

              <input
                required
                placeholder="نوع الهاتف"
                value={repair.device}
                onChange={e =>
                  setRepair({ ...repair, device: e.target.value })
                }
              />

              <textarea
                required
                placeholder="اشرح المشكل"
                value={repair.problem}
                onChange={e =>
                  setRepair({ ...repair, problem: e.target.value })
                }
              />

              <button className="primary full" disabled={busy}>
                {busy ? 'جار الإرسال...' : 'إرسال طلب الإصلاح'}
              </button>
            </form>
          </div>
        </section>

        {adminOpen && (
          <section id="admin" className="section pale">
            <div className="wrap">
              <div className="sectionHead">
                <h2>لوحة الإدارة</h2>

                {session && (
                  <button onClick={() => supabase.auth.signOut()}>
                    تسجيل الخروج
                  </button>
                )}
              </div>

              {!session ? (
                <form className="panel login" onSubmit={login}>
                  <h3>دخول المدير</h3>

                  <input
                    type="email"
                    required
                    placeholder="البريد الإلكتروني"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />

                  <input
                    type="password"
                    required
                    placeholder="كلمة المرور"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />

                  <button className="primary full">
                    دخول
                  </button>
                </form>
              ) : !admin ? (
                <p className="empty">
                  هذا الحساب ليس لديه صلاحية الإدارة.
                </p>
              ) : (
                <div className="adminGrid">
                  <form className="panel" onSubmit={saveProduct}>
                    <h3>
                      {productForm.id
                        ? 'تعديل المنتج'
                        : 'إضافة منتج جديد'}
                    </h3>

                    <input
                      required
                      placeholder="اسم المنتج"
                      value={productForm.name}
                      onChange={e =>
                        setProductForm({
                          ...productForm,
                          name: e.target.value
                        })
                      }
                    />

                    <textarea
                      placeholder="وصف المنتج"
                      value={productForm.description || ''}
                      onChange={e =>
                        setProductForm({
                          ...productForm,
                          description: e.target.value
                        })
                      }
                    />

                    <input
                      required
                      type="number"
                      min="0"
                      placeholder="الثمن بالدرهم"
                      value={productForm.price}
                      onChange={e =>
                        setProductForm({
                          ...productForm,
                          price: e.target.value
                        })
                      }
                    />

                    <select
                      value={productForm.category}
                      onChange={e =>
                        setProductForm({
                          ...productForm,
                          category: e.target.value
                        })
                      }
                    >
                      {categories.slice(1).map(c => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      placeholder="المخزون"
                      value={productForm.stock}
                      onChange={e =>
                        setProductForm({
                          ...productForm,
                          stock: e.target.value
                        })
                      }
                    />

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e =>
                        setImageFile(e.target.files?.[0] || null)
                      }
                    />

                    <button className="primary full">
                      حفظ المنتج
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProductForm({
                          id: null,
                          name: '',
                          description: '',
                          price: '',
                          category: 'هواتف',
                          stock: '1',
                          image_url: '',
                          active: true
                        });
                        setImageFile(null);
                      }}
                    >
                      إلغاء التعديل
                    </button>
                  </form>

                  <div>
                    <div className="panel">
                      <h3>المنتجات ({products.length})</h3>

                      {products.map(p => (
                        <div className="adminRow" key={p.id}>
                          <span>
                            {p.name} — {money(p.price)}
                          </span>

                          <span>
                            <button onClick={() => editProduct(p)}>
                              تعديل
                            </button>

                            <button onClick={() => deleteProduct(p.id)}>
                              حذف
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="panel">
                      <h3>الطلبات ({orders.length})</h3>

                      {orders.map(o => (
                        <div className="adminRow orderCard" key={o.id}>
                          <h4>
                            الطلب رقم #{o.id}
                          </h4>

                          <p>
                            <b>الاسم:</b> {o.customer_name || 'غير متوفر'}
                          </p>

                          <p>
                            <b>الهاتف:</b> {o.phone || 'غير متوفر'}
                          </p>

                          <p>
                            <b>المدينة:</b> {o.city || 'غير متوفر'}
                          </p>

                          <p>
                            <b>العنوان:</b> {o.address || 'غير متوفر'}
                          </p>

                          <p>
                            <b>تاريخ الطلب:</b> {dateText(o.created_at)}
                          </p>

                          <p><b>المنتجات:</b></p>

                          {getOrderItems(o.items).length ? (
                            getOrderItems(o.items).map((item, index) => (
                              <p key={index}>
                                {item.name || 'منتج'} × {item.qty || 1}
                                {' — '}
                                {money(Number(item.price || 0) * Number(item.qty || 1))}
                              </p>
                            ))
                          ) : (
                            <p>تفاصيل المنتجات غير متوفرة</p>
                          )}

                          <p>
                            <b>مجموع الطلب:</b> {money(o.total)}
                          </p>

                          <select
                            value={o.status || 'new'}
                            onChange={e =>
                              updateStatus('orders', o.id, e.target.value)
                            }
                          >
                            <option value="new">جديد</option>
                            <option value="confirmed">مؤكد</option>
                            <option value="shipped">تم الشحن</option>
                            <option value="done">مكتمل</option>
                            <option value="cancelled">ملغي</option>
                          </select>
                        </div>
                      ))}

                      {!orders.length && (
                        <p className="empty">لا توجد طلبات حالياً.</p>
                      )}
                    </div>

                    <div className="panel">
                      <h3>طلبات الإصلاح ({repairs.length})</h3>

                      {repairs.map(r => (
                        <div className="adminRow orderCard" key={r.id}>
                          <h4>طلب إصلاح #{r.id}</h4>

                          <p>
                            <b>الاسم:</b> {r.customer_name}
                          </p>

                          <p>
                            <b>الهاتف:</b> {r.phone}
                          </p>

                          <p>
                            <b>المدينة:</b> {r.city}
                          </p>

                          <p>
                            <b>العنوان:</b> {r.address || 'غير متوفر'}
                          </p>

                          <p>
                            <b>الجهاز:</b> {r.device}
                          </p>

                          <p>
                            <b>المشكل:</b> {r.problem}
                          </p>

                          <select
                            value={r.status || 'new'}
                            onChange={e =>
                              updateStatus(
                                'repair_requests',
                                r.id,
                                e.target.value
                              )
                            }
                          >
                            <option value="new">جديد</option>
                            <option value="contacted">تم التواصل</option>
                            <option value="in_progress">قيد الإصلاح</option>
                            <option value="done">مكتمل</option>
                          </select>
                        </div>
                      ))}

                      {!repairs.length && (
                        <p className="empty">
                          لا توجد طلبات إصلاح حالياً.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}
      </main>

      <footer id="contact">
        <div className="wrap footer">
          <div>
            <a className="brand" href="#">
              <span>RM</span> PHONE
            </a>
            <p>بيع الهواتف والإكسسوارات وصيانة الهواتف.</p>
          </div>

          <div>
            <b>اتصل بنا</b>
            <a href="tel:+212610588759">+212 610 58 87 59</a>
            <a href="tel:+212618324490">+212 618 32 44 90</a>
          </div>

          <div>
            <b>تابعنا</b>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
          </div>
        </div>

        <p className="copyright">
          © {new Date().getFullYear()} RM PHONE — جميع الحقوق محفوظة
        </p>
      </footer>
    </div>
  );
}